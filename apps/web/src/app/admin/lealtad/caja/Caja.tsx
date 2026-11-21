'use client';

import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { describirPremio, type ProgramaLealtad } from '@wl/domain';
import type { VistaCaja } from '@wl/database';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono, iconoDePremio, type NombreIcono } from '@/components/lealtad/Iconos';
import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';
import { MarcaDelNegocio } from '@/components/admin/MarcaDelNegocio';
import { Escaner } from './Escaner';
import { reducirFoto } from './foto';
import { NuevoCliente } from './NuevoCliente';
import { CobrarCupon } from './CobrarCupon';
import { MigrarFisica } from './MigrarFisica';
import { SolicitudesAcceso, type FilaSolicitud } from './SolicitudesAcceso';
import { useMarca } from '@/components/Marca';
import {
  buscarTarjeta,
  entregar,
  registrarVisita,
  reportar,
  subirFotoTicket,
  type RespuestaVisita,
} from './acciones';

/**
 * La caja del programa de lealtad, pensada para la tableta del mostrador.
 *
 * Un flujo por pantalla y un botón principal por paso. Quien atiende tiene
 * fila delante: cada pantalla dice qué hacer a continuación y, si algo falla,
 * qué pasó y cuál es la salida.
 *
 *   Registrar visita: escanear → foto del ticket → datos → resultado
 *   Entregar premio:  escanear → elegir premio → confirmar
 */

type Paso = 'inicio' | 'escanear' | 'tarjeta' | 'ticket' | 'resultado' | 'canje';
type Modo = 'visita' | 'premio';

export interface OperacionReciente {
  readonly cuando: string;
  readonly quien: string;
  readonly que: string;
  readonly bien: boolean;
}

interface Props {
  /** El negocio exige folio o foto también con el QR a la vista. */
  readonly folioObligatorio?: boolean;
  /** El negocio no pide ticket: la visita se suma en un toque, sin pantalla de ticket. */
  readonly sinTicket?: boolean;
  /** Abre directo el escáner (desde «Sumar sello» del inicio o la paleta). */
  readonly empezarCon?: 'visita' | 'premio';
  /** Abre directo esta tarjeta, sin escanear. */
  readonly codigoInicial?: string;
  /** Abre directo el alta de un cliente nuevo (desde «Clientes» vacío). */
  readonly empezarConAlta?: boolean;
  /** Abre directo el cobro de una promoción del juego (desde la paleta). */
  readonly empezarConPromo?: boolean;
  /** Colores y plantilla del negocio, para mostrar la tarjeta como la ve el cliente. */
  readonly marcaNegocio: { readonly estilo: CSSProperties; readonly plantilla: string };
  readonly sucursal: {
    readonly slug: string;
    readonly nombre: string;
    readonly participa: boolean;
  };
  readonly hoy: string;
  readonly fotosActivas: boolean;
  readonly operaciones: readonly OperacionReciente[];
  readonly pendientes: number;
  readonly programa: ProgramaLealtad;
  /** «Olvidé mi contraseña» de tarjetas solo con celular. */
  readonly solicitudes: readonly FilaSolicitud[];
  readonly verSucursalSolicitudes: boolean;
  /** El club tiene «Juega y gana»: la caja cobra sus promociones. Lleva el prefijo de los códigos. */
  readonly cupones?: { readonly prefijo: string } | null;
}

const CAMPO =
  'min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-base focus:border-ink focus:outline-none';

const ticketVacio = (hoy: string) => ({
  folio: '',
  caja: '1',
  fecha: hoy,
  total: '',
  propina: '',
  descuento: '',
});

export function Caja({
  sucursal,
  hoy,
  fotosActivas,
  operaciones,
  pendientes,
  programa,
  solicitudes,
  verSucursalSolicitudes,
  folioObligatorio = false,
  sinTicket = false,
  marcaNegocio,
  empezarCon,
  codigoInicial,
  empezarConAlta = false,
  empezarConPromo = false,
  cupones = null,
}: Props) {
  const marca = useMarca();
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>(empezarCon || codigoInicial ? 'escanear' : 'inicio');
  const [modo, setModo] = useState<Modo>(empezarCon ?? 'visita');
  const [nuevoCliente, setNuevoCliente] = useState(empezarConAlta);
  const [cobrarPromo, setCobrarPromo] = useState(empezarConPromo);
  const [tarjeta, setTarjeta] = useState<VistaCaja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const [ticket, setTicket] = useState(ticketVacio(hoy));
  const [confirmado, setConfirmado] = useState(false);
  const [foto, setFoto] = useState<{
    vista: string | null;
    url: string | null;
    subiendo: boolean;
    error: string | null;
  }>({ vista: null, url: null, subiendo: false, error: null });
  const [resultado, setResultado] = useState<RespuestaVisita | null>(null);
  const [motivo, setMotivo] = useState('Sin internet en el momento de la compra');

  const [premioElegido, setPremioElegido] = useState<string | null>(null);
  const [entregaConfirmada, setEntregaConfirmada] = useState(false);
  const [entrega, setEntrega] = useState<{ ok: boolean; texto: string } | null>(null);
  const [reportado, setReportado] = useState(false);

  function reiniciar() {
    setPaso('inicio');
    setNuevoCliente(false);
    setCobrarPromo(false);
    setTarjeta(null);
    setError(null);
    setTicket(ticketVacio(hoy));
    setConfirmado(false);
    setFoto({ vista: null, url: null, subiendo: false, error: null });
    setResultado(null);
    setPremioElegido(null);
    setEntregaConfirmada(false);
    setEntrega(null);
    setReportado(false);
    router.refresh();
  }

  function empezar(m: Modo) {
    reiniciar();
    setModo(m);
    setPaso('escanear');
  }

  const buscar = useCallback(
    (texto: string) => {
      setError(null);
      iniciar(async () => {
        const r = await buscarTarjeta(texto, sucursal.slug);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setTarjeta(r.tarjeta);
        setPaso('tarjeta');
      });
    },
    [sucursal.slug],
  );

  // Abre directo la tarjeta pedida, una sola vez (el primer sello del dueño).
  const abierta = useRef(false);
  useEffect(() => {
    if (!codigoInicial || abierta.current) return;
    abierta.current = true;
    buscar(codigoInicial);
  }, [codigoInicial, buscar]);

  async function tomarFoto(archivo: File | undefined) {
    if (!archivo) return;
    setFoto({ vista: null, url: null, subiendo: true, error: null });
    try {
      const reducida = await reducirFoto(archivo);
      const vista = URL.createObjectURL(reducida);
      setFoto({ vista, url: null, subiendo: fotosActivas, error: null });
      if (!fotosActivas) return;
      const datos = new FormData();
      datos.set('sucursal', sucursal.slug);
      datos.set('foto', new File([reducida], 'ticket.jpg', { type: 'image/jpeg' }));
      const r = await subirFotoTicket(datos);
      setFoto({ vista, url: r.ok ? r.url : null, subiendo: false, error: r.ok ? null : r.error });
    } catch {
      setFoto({
        vista: null,
        url: null,
        subiendo: false,
        error: 'No se pudo leer la foto. Tómala de nuevo.',
      });
    }
  }

  // Lo que no se capturó del ticket. Informa, no bloquea.
  const faltanDatos = [
    !foto.url && 'foto',
    !ticket.folio.trim() && 'folio',
    !ticket.total.trim() && 'total',
  ].filter((x): x is string => Boolean(x));

  function acreditar(registrarComo?: 'CONTINGENCIA' | 'REVISION') {
    if (!tarjeta) return;
    setError(null);
    iniciar(async () => {
      const r = await registrarVisita({
        codigo: tarjeta.codigo,
        sucursalSlug: sucursal.slug,
        ...ticket,
        fotoUrl: foto.url,
        registrarComo,
        nota: registrarComo === 'CONTINGENCIA' ? motivo : undefined,
      });
      if (r.tipo === 'ERROR') {
        setError(r.error);
        return;
      }
      if (r.tarjeta) setTarjeta(r.tarjeta);
      setResultado(r);
      setPaso('resultado');
    });
  }

  function confirmarEntrega() {
    if (!tarjeta || !premioElegido) return;
    iniciar(async () => {
      const r = await entregar(tarjeta.codigo, premioElegido, sucursal.slug);
      if (r.ok) {
        if (r.tarjeta) setTarjeta(r.tarjeta);
        setEntrega({ ok: true, texto: r.nombre });
      } else {
        setEntrega({ ok: false, texto: r.error });
      }
    });
  }

  function reportarIncidencia(detalle: string) {
    iniciar(async () => {
      await reportar(tarjeta?.codigo ?? null, sucursal.slug, detalle);
      setReportado(true);
    });
  }

  // -------------------------------------------------------------------------
  // Pantallas
  // -------------------------------------------------------------------------

  if (cobrarPromo && cupones) {
    return <CobrarCupon sucursal={sucursal} prefijo={cupones.prefijo} onTerminar={reiniciar} />;
  }

  if (nuevoCliente) {
    return (
      <NuevoCliente
        sucursal={sucursal}
        programa={programa}
        hoy={hoy}
        fotosActivas={fotosActivas}
        onCancelar={reiniciar}
        onTerminar={reiniciar}
      />
    );
  }

  if (paso === 'inicio') {
    return (
      <div className="grid gap-5">
        {!sucursal.participa && (
          <Aviso tono="atencion" titulo={`${sucursal.nombre} todavía no participa en el programa`}>
            Puedes revisar tarjetas, pero no acreditar visitas ni entregar premios hasta que
            administración la incorpore.
          </Aviso>
        )}
        <div className="grid gap-3">
          <BotonGrande
            principal
            icono="qr"
            titulo="Sumar sello de visita"
            texto={
              sinTicket
                ? 'Escanea la tarjeta del cliente.'
                : 'Escanea la tarjeta y toma foto del ticket.'
            }
            onClick={() => empezar('visita')}
          />
          <BotonGrande
            icono="regalo"
            titulo="Entregar premio"
            texto="Escanea la tarjeta y confirma la entrega."
            onClick={() => empezar('premio')}
          />
          <BotonGrande
            icono="persona"
            titulo="Cliente sin tarjeta a la mano"
            texto="Con su celular o correo. Si todavía no tiene tarjeta, se crea aquí."
            onClick={() => {
              reiniciar();
              setNuevoCliente(true);
            }}
          />
          {cupones && (
            <BotonGrande
              icono="control"
              titulo="Cobrar promoción del juego"
              texto="El cliente te enseña el código que ganó en «Juega y gana»."
              onClick={() => {
                reiniciar();
                setCobrarPromo(true);
              }}
            />
          )}
        </div>

        <SolicitudesAcceso filas={solicitudes} verSucursal={verSucursalSolicitudes} />

        {pendientes > 0 && (
          <p className="flex items-center gap-2 rounded-md border border-rule bg-cream px-3.5 py-3 text-sm text-ink-soft">
            <Icono nombre="reloj" className="text-agotado" />
            {pendientes} {pendientes === 1 ? 'visita pendiente' : 'visitas pendientes'} de revisión
            central en esta sucursal.
          </p>
        )}

        <section className="grid gap-2">
          <h2 className="text-lg text-ink">Hoy en esta caja</h2>
          {operaciones.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay operaciones hoy.</p>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
              {operaciones.map((o, i) => (
                <li key={i} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                  <span
                    className={`grid h-8 w-8 flex-none place-items-center rounded-full ${o.bien ? 'bg-disponible/10 text-disponible' : 'bg-agotado/10 text-agotado'}`}
                  >
                    <Icono nombre={o.bien ? 'palomita' : 'reloj'} width={16} height={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block font-semibold text-ink">{o.quien}</b>
                    <span className="text-xs text-muted">{o.que}</span>
                  </span>
                  <span className="font-mono text-xs text-ink-soft tabular-nums">{o.cuando}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const encabezado = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        onClick={reiniciar}
        className="inline-flex min-h-[40px] items-center gap-1 text-sm text-crust-dark underline underline-offset-4"
      >
        <Icono nombre="izquierda" width={16} height={16} /> Cancelar
      </button>
      <span className="text-sm font-semibold text-ink">
        {modo === 'visita' ? 'Sumar sello de visita' : 'Entregar premio'}
      </span>
    </div>
  );

  const pasos =
    modo === 'visita'
      ? sinTicket
        ? ['Escanear', 'Listo']
        : ['Escanear', 'Foto', 'Datos', 'Listo']
      : ['Escanear', 'Premio', 'Listo'];
  const indice =
    modo === 'visita'
      ? sinTicket
        ? { escanear: 0, tarjeta: 0, ticket: 0, resultado: 1, canje: 1, inicio: 0 }[paso]
        : {
            escanear: 0,
            tarjeta: 0,
            ticket: foto.vista ? 2 : 1,
            resultado: 3,
            canje: 3,
            inicio: 0,
          }[paso]
      : { escanear: 0, tarjeta: 0, canje: entrega?.ok ? 2 : 1, ticket: 1, resultado: 2, inicio: 0 }[
          paso
        ];

  return (
    <div className="grid max-w-2xl gap-4">
      {encabezado}
      <Pasos pasos={pasos} actual={indice} />

      {paso === 'escanear' && (
        <>
          <Escaner alLeer={buscar} />
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const texto = new FormData(e.currentTarget).get('codigo');
              buscar(String(texto ?? ''));
            }}
          >
            <label htmlFor="codigo" className="text-sm font-semibold text-ink">
              O escribe el código de la tarjeta
            </label>
            <div className="flex gap-2">
              <input
                id="codigo"
                name="codigo"
                autoFocus
                autoComplete="off"
                placeholder={marca.ejemploCodigo}
                className={`${CAMPO} font-mono`}
              />
              <button
                type="submit"
                disabled={ocupado}
                className="min-h-[48px] flex-none rounded-sm bg-ink px-5 font-semibold text-cream disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
            <p className="text-xs text-muted">
              El código identifica la tarjeta en caja; no da acceso a la cuenta del cliente.
            </p>
          </form>
          <p className="text-sm text-ink-soft">
            ¿La persona ya no tiene su tarjeta en el celular?{' '}
            <a
              href="/admin/lealtad/caja/acceso"
              className="font-semibold text-crust-dark underline underline-offset-4"
            >
              Reponer su acceso
            </a>
          </p>
          {ocupado && <p className="text-sm text-muted">Buscando…</p>}
          {error && <Aviso tono="error">{error}</Aviso>}
        </>
      )}

      {paso === 'tarjeta' && tarjeta && (
        <>
          <Ficha tarjeta={tarjeta} modo={modo} programa={programa} />
          {modo === 'visita' && sucursal.participa && (
            <MigrarFisica
              tarjeta={tarjeta}
              sucursalSlug={sucursal.slug}
              programa={programa}
              onListo={setTarjeta}
            />
          )}
          {modo === 'visita' && (
            <button
              type="button"
              disabled={tarjeta.acumuloHoyAqui || !sucursal.participa || ocupado}
              onClick={() => (sinTicket ? acreditar() : setPaso('ticket'))}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-sm bg-ink px-6 text-base font-semibold text-cream hover:bg-ink-soft disabled:opacity-40"
            >
              {sinTicket ? (
                <>
                  <Icono nombre="palomita" /> {ocupado ? 'Sumando…' : 'Sumar sello'}
                </>
              ) : (
                <>
                  <Icono nombre="camara" /> Registrar el ticket
                </>
              )}
            </button>
          )}
          {tarjeta.premiosDisponibles.length > 0 && (
            <button
              type="button"
              disabled={!sucursal.participa}
              onClick={() => {
                setPremioElegido(
                  tarjeta.premiosDisponibles.length === 1
                    ? tarjeta.premiosDisponibles[0]!.id
                    : null,
                );
                setModo('premio');
                setPaso('canje');
              }}
              className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm px-6 font-semibold disabled:opacity-40 ${modo === 'premio' ? 'bg-ink text-cream hover:bg-ink-soft' : 'bg-crust-dark text-cream hover:bg-[#77411a]'}`}
            >
              <Icono nombre="regalo" /> Entregar premio
            </button>
          )}
          {modo === 'premio' && tarjeta.premiosDisponibles.length === 0 && (
            <Aviso tono="neutro" titulo="No hay premio que entregar" icono="regalo">
              Esta tarjeta todavía no tiene premios disponibles.
            </Aviso>
          )}
          {modo === 'visita' && tarjeta.acumuloHoyAqui && (
            <button
              type="button"
              onClick={reiniciar}
              className="min-h-[44px] text-sm text-crust-dark underline"
            >
              Terminar sin acreditar
            </button>
          )}
        </>
      )}

      {paso === 'ticket' && tarjeta && (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            acreditar();
          }}
        >
          <div className="grid gap-2">
            <span className="text-sm font-semibold text-ink">Foto del ticket</span>
            {foto.vista ? (
              <img
                src={foto.vista}
                alt="Ticket fotografiado"
                className="max-h-72 w-full rounded-lg bg-[#1c1611] object-contain"
              />
            ) : (
              <div className="grid aspect-[4/3] max-h-72 w-full place-items-center rounded-lg bg-[#1c1611] px-6 text-center text-sm text-cream/85">
                Encuadra el ticket completo, con buena luz y sin sombras. Que se lean el folio y el
                total.
              </div>
            )}
            <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-sm border-[1.5px] border-ink px-5 font-semibold text-ink hover:bg-cream">
              <Icono nombre="camara" />
              {foto.vista ? 'Repetir foto' : 'Tomar foto'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => void tomarFoto(e.target.files?.[0])}
              />
            </label>
            {foto.subiendo && <p className="text-xs text-muted">Guardando la foto…</p>}
            {foto.error && <Aviso tono="error">{foto.error}</Aviso>}
            <p className="text-xs text-muted">
              {fotosActivas
                ? 'La foto es la evidencia de la visita. Si no se puede tomar, acredita de todos modos.'
                : 'El almacén de fotos todavía no está configurado: la visita se registra sin la foto.'}
            </p>
          </div>

          <div className="grid gap-3">
            <Campo
              etiqueta="Folio"
              id="folio"
              nota={folioObligatorio ? 'obligatorio' : 'si se puede'}
            >
              <input
                id="folio"
                value={ticket.folio}
                onChange={(e) => setTicket({ ...ticket, folio: e.target.value })}
                placeholder="C2-12071"
                className={`${CAMPO} font-mono`}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha de compra" id="fecha">
                <input
                  id="fecha"
                  type="date"
                  required
                  max={hoy}
                  value={ticket.fecha}
                  onChange={(e) => setTicket({ ...ticket, fecha: e.target.value })}
                  className={CAMPO}
                />
              </Campo>
              <Campo etiqueta="Caja o serie" id="caja">
                <input
                  id="caja"
                  value={ticket.caja}
                  onChange={(e) => setTicket({ ...ticket, caja: e.target.value })}
                  className={`${CAMPO} font-mono`}
                />
              </Campo>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Total pagado" id="total" nota="si se puede">
                <input
                  id="total"
                  inputMode="decimal"
                  value={ticket.total}
                  onChange={(e) => setTicket({ ...ticket, total: e.target.value })}
                  placeholder="0.00"
                  className={`${CAMPO} font-mono`}
                />
              </Campo>
              <Campo etiqueta="Propina" id="propina" nota="no cuenta">
                <input
                  id="propina"
                  inputMode="decimal"
                  value={ticket.propina}
                  onChange={(e) => setTicket({ ...ticket, propina: e.target.value })}
                  placeholder="0.00"
                  className={`${CAMPO} font-mono`}
                />
              </Campo>
              <Campo etiqueta="Descuento" id="descuento">
                <input
                  id="descuento"
                  inputMode="decimal"
                  value={ticket.descuento}
                  onChange={(e) => setTicket({ ...ticket, descuento: e.target.value })}
                  placeholder="0.00"
                  className={`${CAMPO} font-mono`}
                />
              </Campo>
            </div>
            <p className="text-xs text-muted">
              Hoy cuenta{' '}
              {programa.modalidad === 'VISITA'
                ? 'un sello por visita, sin importar el importe'
                : 'por importe'}
              . La propina nunca suma.
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border-[1.5px] border-ink bg-cream p-4">
            <label className="flex items-start gap-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5 h-5 w-5 flex-none accent-ink"
              />
              Confirmo que el cliente compró hoy y los datos capturados coinciden con el ticket
            </label>
            <button
              type="submit"
              disabled={!confirmado || ocupado || foto.subiendo}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-sm bg-ink px-6 text-base font-semibold text-cream hover:bg-ink-soft disabled:opacity-40"
            >
              <Icono nombre="palomita" /> {ocupado ? 'Validando…' : 'Confirmar y acreditar'}
            </button>
            {faltanDatos.length > 0 && (
              <p className="text-xs text-muted">
                Faltan datos del ticket ({faltanDatos.join(', ')}). Se puede acreditar igual; queda
                anotado para administración.
              </p>
            )}
          </div>
          {error && <Aviso tono="error">{error}</Aviso>}
        </form>
      )}

      {paso === 'resultado' && resultado && tarjeta && (
        <Resultado
          marca={marcaNegocio}
          r={resultado}
          tarjeta={tarjeta}
          programa={programa}
          ocupado={ocupado}
          motivo={motivo}
          setMotivo={setMotivo}
          reportado={reportado}
          onContingencia={() => acreditar('CONTINGENCIA')}
          onRevision={() => acreditar('REVISION')}
          onCorregir={() => setPaso('ticket')}
          onReportar={reportarIncidencia}
          onEntregar={() => {
            setPremioElegido(
              tarjeta.premiosDisponibles.length === 1 ? tarjeta.premiosDisponibles[0]!.id : null,
            );
            setModo('premio');
            setPaso('canje');
          }}
          onSiguiente={reiniciar}
        />
      )}

      {paso === 'canje' && tarjeta && (
        <div className="grid gap-4">
          {entrega?.ok ? (
            <>
              <div className="grid justify-items-center gap-1 rounded-lg bg-disponible/10 p-5 text-center">
                <Icono nombre="regalo" width={36} height={36} className="text-disponible" />
                <p className="font-display text-xl text-ink">Premio entregado: {entrega.texto}</p>
                <p className="text-sm text-ink-soft">
                  {sucursal.nombre} · {new Date().toLocaleDateString('es-MX')}
                </p>
              </div>
              <Aviso tono="neutro" titulo="Entregar un premio no suma sellos">
                Si el cliente también compró, registra esa compra con su ticket.
              </Aviso>
              <BotonSiguiente onClick={reiniciar} />
            </>
          ) : (
            <>
              <FichaBreve tarjeta={tarjeta} />
              {!tarjeta.verificada && (
                <Aviso tono="atencion" titulo="Primero debe verificar su correo o su celular">
                  El correo lo verifica desde su tarjeta en menos de un minuto. El celular queda
                  verificado cuando abre un enlace que la caja le manda por WhatsApp. El premio se
                  conserva.
                </Aviso>
              )}
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-lg text-ink">Elige el premio que entregas</legend>
                {tarjeta.premiosDisponibles.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border-[1.5px] bg-cream px-3.5 py-3 ${premioElegido === p.id ? 'border-ink' : 'border-rule'}`}
                  >
                    <input
                      type="radio"
                      name="premio"
                      checked={premioElegido === p.id}
                      onChange={() => setPremioElegido(p.id)}
                      className="h-5 w-5 accent-ink"
                    />
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent/15 text-crust-dark">
                      <Icono nombre={iconoDePremio(p.posicion, programa)} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink-soft">
                      <b className="block text-[15px] font-semibold text-ink">{p.nombre}</b>
                      {p.incluye}
                      <span className="block text-xs text-muted">
                        Estampa {p.posicion} · tarjeta {p.ciclo}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-3 rounded-lg border-[1.5px] border-ink bg-cream p-4">
                <label className="flex items-start gap-3 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={entregaConfirmada}
                    onChange={(e) => setEntregaConfirmada(e.target.checked)}
                    className="mt-0.5 h-5 w-5 flex-none accent-ink"
                  />
                  Confirmo que entregué el producto al cliente
                </label>
                <button
                  type="button"
                  onClick={confirmarEntrega}
                  disabled={!premioElegido || !entregaConfirmada || !tarjeta.verificada || ocupado}
                  className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-sm bg-ink px-6 text-base font-semibold text-cream hover:bg-ink-soft disabled:opacity-40"
                >
                  <Icono nombre="palomita" /> {ocupado ? 'Registrando…' : 'Confirmar entrega'}
                </button>
                <p className="text-xs text-muted">
                  La entrega es única: si otra caja intenta entregar el mismo premio, el sistema lo
                  rechaza.
                </p>
              </div>
              {entrega && !entrega.ok && <Aviso tono="error">{entrega.texto}</Aviso>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function BotonGrande(p: {
  principal?: boolean;
  icono: NombreIcono;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      className={`grid min-h-[140px] content-start gap-2 rounded-lg border-[1.5px] p-5 text-left ${p.principal ? 'border-ink bg-ink text-cream hover:bg-ink-soft' : 'border-rule bg-cream text-ink hover:border-[#cbbca6]'}`}
    >
      <Icono
        nombre={p.icono}
        width={28}
        height={28}
        className={p.principal ? 'text-crust-light' : 'text-crust'}
      />
      <b className="font-display text-xl leading-tight">{p.titulo}</b>
      <span className={`text-sm ${p.principal ? 'text-cream/75' : 'text-muted'}`}>{p.texto}</span>
    </button>
  );
}

function Pasos({ pasos, actual }: { pasos: readonly string[]; actual: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto rounded-md border border-rule bg-cream px-3 py-2 text-xs">
      {pasos.map((p, i) => (
        <li
          key={p}
          aria-current={i === actual ? 'step' : undefined}
          className={`flex flex-none items-center gap-1.5 ${i === actual ? 'font-semibold text-ink' : 'text-muted'}`}
        >
          <span
            className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[10.5px] ${i < actual ? 'bg-disponible text-cream' : i === actual ? 'bg-ink text-cream' : 'border border-rule'}`}
          >
            {i < actual ? '✓' : i + 1}
          </span>
          {p}
          {i < pasos.length - 1 && <span aria-hidden="true" className="mx-1 h-px w-6 bg-rule" />}
        </li>
      ))}
    </ol>
  );
}

function MiniSellos({ estampas, programa }: { estampas: number; programa: ProgramaLealtad }) {
  return (
    <span
      className="flex items-center gap-1"
      aria-label={`${estampas} de ${programa.posiciones} sellos`}
    >
      {Array.from({ length: programa.posiciones }, (_, i) => {
        const hito = programa.hitos.some((h) => h.posicion === i + 1);
        const on = i < estampas;
        return (
          <i
            key={i}
            className={`block h-4 w-4 rounded-full ${on ? (hito ? 'bg-crust-light' : 'bg-crust') : hito ? 'border-[1.5px] border-crust-light' : 'border-[1.5px] border-dashed border-[#cbbca6]'}`}
          />
        );
      })}
      <small className="ml-1.5 font-mono text-xs font-semibold text-ink-soft">
        {estampas}/{programa.posiciones}
      </small>
    </span>
  );
}

function FichaBreve({ tarjeta }: { tarjeta: VistaCaja }) {
  const iniciales = (tarjeta.nombre ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-ink font-display text-cream">
        {iniciales || <Icono nombre="persona" width={20} height={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block font-semibold text-ink">{tarjeta.nombre ?? 'Cliente sin nombre'}</b>
        <span className="font-mono text-xs text-muted">
          {tarjeta.codigo} · {tarjeta.contacto}
        </span>
      </span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tarjeta.verificada ? 'bg-disponible/10 text-disponible' : 'bg-agotado/10 text-agotado'}`}
      >
        {tarjeta.verificada ? 'Verificada' : 'Sin verificar'}
      </span>
    </div>
  );
}

function Ficha({
  tarjeta,
  modo,
  programa,
}: {
  tarjeta: VistaCaja;
  modo: Modo;
  programa: ProgramaLealtad;
}) {
  const disp = tarjeta.premiosDisponibles;
  return (
    <div className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
      <FichaBreve tarjeta={tarjeta} />
      <MiniSellos estampas={tarjeta.estampas} programa={programa} />
      <ul className="grid gap-2 text-sm">
        {modo === 'visita' &&
          (tarjeta.acumuloHoyAqui ? (
            <li className="flex items-start gap-2.5">
              <Icono nombre="cruz" className="mt-0.5 text-danger" />
              <span>
                <b className="font-semibold">Ya acumuló hoy en esta sucursal.</b> Otra compra hoy
                aquí no suma sellos.
              </span>
            </li>
          ) : (
            <li className="flex items-start gap-2.5">
              <Icono nombre="palomita" className="mt-0.5 text-disponible" />
              <span>
                <b className="font-semibold">Puede acumular hoy.</b> Fotografía el ticket si se
                puede y acredita la visita.
              </span>
            </li>
          ))}
        <li className="flex items-start gap-2.5">
          <Icono
            nombre="regalo"
            className={`mt-0.5 ${disp.length ? 'text-crust-dark' : 'text-muted'}`}
          />
          <span className={disp.length ? '' : 'text-muted'}>
            {disp.length > 0 ? (
              <>
                <b className="font-semibold">Premio disponible:</b>{' '}
                {disp.map((p) => p.nombre).join(', ')}
                {tarjeta.verificada
                  ? '.'
                  : '. Debe verificar su correo o su celular antes de canjear.'}
              </>
            ) : tarjeta.proximo ? (
              `Sin premios disponibles · le ${tarjeta.proximo.faltan === 1 ? 'falta 1 sello' : `faltan ${tarjeta.proximo.faltan} sellos`} para ${tarjeta.proximo.premio.toLowerCase()}.`
            ) : (
              'Sin premios disponibles.'
            )}
          </span>
        </li>
      </ul>
    </div>
  );
}

function BotonSiguiente({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[56px] items-center justify-center rounded-sm bg-ink px-6 text-base font-semibold text-cream hover:bg-ink-soft"
    >
      Listo, siguiente cliente
    </button>
  );
}

function Resultado(p: {
  marca: { readonly estilo: CSSProperties; readonly plantilla: string };
  r: RespuestaVisita;
  tarjeta: VistaCaja;
  programa: ProgramaLealtad;
  ocupado: boolean;
  motivo: string;
  setMotivo: (m: string) => void;
  reportado: boolean;
  onContingencia: () => void;
  onRevision: () => void;
  onCorregir: () => void;
  onReportar: (detalle: string) => void;
  onEntregar: () => void;
  onSiguiente: () => void;
}) {
  const { r, tarjeta } = p;
  if (r.tipo === 'ERROR') return <Aviso tono="error">{r.error}</Aviso>;

  if (r.tipo === 'ACREDITADA') {
    const nuevas: number[] = [];
    for (let i = 0; i < Math.min(r.estampas, r.despues.estampas); i++)
      nuevas.push(r.despues.estampas - 1 - i);
    return (
      <div className="grid gap-4">
        <div className="grid justify-items-center gap-1 rounded-lg bg-disponible/10 p-5 text-center">
          <span className="font-display text-5xl leading-none text-disponible">+{r.estampas}</span>
          <p className="font-display text-xl text-ink">
            {r.estampas === 1 ? 'sello' : 'sellos'} para {tarjeta.nombre ?? 'la tarjeta'}
          </p>
          <p className="text-sm text-ink-soft">
            {r.antes.estampas} → {r.despues.estampas} de {p.programa.posiciones}
            {r.despues.ciclo > r.antes.ciclo ? ' · tarjeta completa, empieza una nueva' : ''}
          </p>
        </div>
        <MarcaDelNegocio estilo={p.marca.estilo} plantilla={p.marca.plantilla}>
          <div className="mx-auto w-full max-w-sm">
            <TarjetaSellos
              compacta
              programa={p.programa}
              nuevas={nuevas.reverse()}
              datos={{
                estampas: r.despues.estampas,
                ciclo: r.despues.ciclo,
                nombre: tarjeta.nombre,
                premios: tarjeta.premiosDisponibles.map((x) => ({ ...x, disponible: true })),
              }}
            />
          </div>
        </MarcaDelNegocio>
        {r.premios.length > 0 && (
          <Aviso
            tono="ok"
            titulo={`Premio generado: ${r.premios.map((x) => describirPremio(p.programa, x.premio).nombre).join(' y ')}`}
            icono="regalo"
          >
            {tarjeta.verificada
              ? 'Puedes entregarlo ahora mismo.'
              : 'El cliente debe verificar su correo o su celular antes de canjear.'}
          </Aviso>
        )}
        {tarjeta.premiosDisponibles.length > 0 && tarjeta.verificada && (
          <button
            type="button"
            onClick={p.onEntregar}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm bg-crust-dark px-6 font-semibold text-cream hover:bg-[#77411a]"
          >
            <Icono nombre="regalo" /> Entregar premio ahora
          </button>
        )}
        <BotonSiguiente onClick={p.onSiguiente} />
      </div>
    );
  }

  if (r.tipo === 'PENDIENTE') {
    return (
      <div className="grid gap-4">
        <Aviso tono="atencion" titulo="Guardado como pendiente" icono="reloj">
          {r.razon === 'CONTINGENCIA'
            ? 'Se conserva la fecha real de compra. El dueño o la gerencia lo confirmará y entonces se sumará el sello.'
            : 'El dueño o la gerencia revisará el ticket con su foto y decidirá.'}
        </Aviso>
        <BotonSiguiente onClick={p.onSiguiente} />
      </div>
    );
  }

  if (r.tipo === 'PREGUNTAR_CONTINGENCIA') {
    return (
      <div className="grid gap-4">
        <Aviso
          tono="atencion"
          titulo={`Ticket de hace ${r.diasAtras === 1 ? '1 día' : `${r.diasAtras} días`}`}
          icono="reloj"
        >
          Se puede registrar como contingencia conservando la fecha real de compra. Queda pendiente
          hasta que administración lo confirme.
        </Aviso>
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Motivo
          <select value={p.motivo} onChange={(e) => p.setMotivo(e.target.value)} className={CAMPO}>
            <option>Sin internet en el momento de la compra</option>
            <option>Tableta descargada o apagada</option>
            <option>El cliente no traía su código en el momento</option>
            <option>Otro</option>
          </select>
        </label>
        <button
          type="button"
          disabled={p.ocupado}
          onClick={p.onContingencia}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm bg-ink px-6 font-semibold text-cream disabled:opacity-50"
        >
          <Icono nombre="reloj" /> Registrar como contingencia
        </button>
        <button
          type="button"
          onClick={p.onSiguiente}
          className="min-h-[44px] text-sm text-crust-dark underline"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  // Rechazada
  const texto = r.texto ?? {
    titulo: 'No encontramos la tarjeta',
    detalle: 'Vuelve a escanear el código.',
  };
  const corregible =
    r.motivo === 'FALTA_FOLIO' || r.motivo === 'FALTA_FECHA' || r.motivo === 'FECHA_FUTURA';
  const reportable = r.motivo === 'TICKET_DUPLICADO' || r.motivo === 'YA_ACUMULO_EN_FECHA';
  return (
    <div className="grid gap-4">
      <div className="grid justify-items-center gap-1 rounded-lg bg-danger/10 p-5 text-center">
        <Icono nombre="cruz" width={36} height={36} className="text-danger" />
        <p className="font-display text-xl text-danger">{texto.titulo}</p>
        <p className="max-w-[46ch] text-sm text-ink-soft">{texto.detalle}</p>
      </div>
      {corregible && (
        <button
          type="button"
          onClick={p.onCorregir}
          className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-ink px-6 font-semibold text-cream"
        >
          Corregir los datos
        </button>
      )}
      {r.motivo === 'FUERA_DE_VENTANA' && (
        <button
          type="button"
          disabled={p.ocupado}
          onClick={p.onRevision}
          className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-ink px-6 font-semibold text-cream disabled:opacity-50"
        >
          Enviar a revisión central
        </button>
      )}
      {reportable &&
        (p.reportado ? (
          <Aviso tono="ok">Incidencia enviada a administración.</Aviso>
        ) : (
          <button
            type="button"
            disabled={p.ocupado}
            onClick={() => p.onReportar(`${texto.titulo}. ${texto.detalle}`)}
            className="inline-flex min-h-[48px] items-center justify-center rounded-sm border-[1.5px] border-ink px-6 font-semibold text-ink disabled:opacity-50"
          >
            Reportar incidencia
          </button>
        ))}
      <button
        type="button"
        onClick={p.onSiguiente}
        className="min-h-[44px] text-sm text-crust-dark underline"
      >
        Volver al inicio
      </button>
    </div>
  );
}

function Campo({
  etiqueta,
  id,
  nota,
  children,
}: {
  etiqueta: string;
  id: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {etiqueta} {nota && <span className="font-normal text-muted">· {nota}</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Reduce la foto a 1600 px y la vuelve a codificar como JPG.
 *
 * Además de aligerarla para subirla por una conexión de sucursal, redibujarla
 * en un lienzo borra los metadatos (ubicación, modelo del teléfono).
 */
