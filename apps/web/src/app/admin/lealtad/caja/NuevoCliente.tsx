'use client';

import { useState, useTransition } from 'react';
import type { AccesoTarjetaCaja, VistaCaja } from '@wl/database';
import {
  nombresCoinciden,
  repartirNombre,
  validarComprobanteSinTarjeta,
  type ProgramaLealtad,
} from '@wl/domain';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono } from '@/components/lealtad/Iconos';
import type { RespuestaVisita } from './acciones';
import { FotoTarjetaFisica } from './FotoTarjetaFisica';
import { FotoTicket } from './FotoTicket';
import { MigrarFisica } from './MigrarFisica';
import { ReenviarAcceso, type EnvioReenvio } from './ReenviarAcceso';
import {
  acreditarSinTarjeta,
  buscarPorContacto,
  marcarBienvenidaPorWhatsApp,
  registrarNuevoCliente,
  type RespuestaNuevoCliente,
} from './nuevo-cliente';

const CAMPO =
  'min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-base focus:border-ink focus:outline-none';

/**
 * «Registrar visita sin tarjeta»: el cliente no trae su QR a la mano (o no
 * tiene tarjeta). Sin la tarjeta a la vista, la caja exige lo que con el QR
 * es solo deseable: el nombre que dice la persona y el comprobante de compra
 * (foto del ticket o folio). Es la defensa contra sumar visitas a un contacto
 * conocido sin haber comprado.
 *
 * 1. Nombre + celular o correo.
 * 2. Si ya hay tarjeta con ese contacto, se coteja el nombre con el registrado
 *    (aviso, no bloqueo), se captura el comprobante y se acredita la visita de
 *    hoy. Ahí mismo se puede migrar la tarjeta física y volver a mandarle el
 *    enlace de su tarjeta (WhatsApp, correo o QR), antes o después de
 *    acreditar: es lo que necesita quien no abrió a tiempo la bienvenida.
 * 3. Si no la hay, se completa el nombre (ya repartido en sus tres campos), se
 *    captura el comprobante y se crea la tarjeta con la visita de hoy
 *    acumulada y el acceso en camino (correo) o listo para WhatsApp.
 */
export function NuevoCliente({
  sucursal,
  programa,
  hoy,
  fotosActivas,
  onCancelar,
  onTerminar,
}: {
  sucursal: { slug: string; nombre: string; participa: boolean };
  programa: ProgramaLealtad;
  /** Fecha local de hoy, "AAAA-MM-DD". */
  hoy: string;
  /** Si el almacén de fotos está configurado; si no, el folio es el único comprobante. */
  fotosActivas: boolean;
  onCancelar: () => void;
  onTerminar: () => void;
}) {
  const [datos, setDatos] = useState({
    /** Lo que dice la persona en el primer paso; se coteja o se reparte. */
    nombreDicho: '',
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    celular: '',
    correo: '',
    folio: '',
    traeTarjetaFisica: false,
    visitasFisicas: '',
  });
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoTicket, setFotoTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Extract<RespuestaNuevoCliente, { ok: true }> | null>(
    null,
  );
  const [ocupado, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);
  /** null: todavía no se buscó; 'nueva': no hay tarjeta; VistaCaja: ya existe. */
  const [existente, setExistente] = useState<VistaCaja | 'nueva' | null>(null);
  const [visita, setVisita] = useState<RespuestaVisita | null>(null);
  /** Si la tarjeta encontrada ya se abrió en un celular (para el reenvío). */
  const [acceso, setAcceso] = useState<AccesoTarjetaCaja | null>(null);
  /** Último enlace reenviado; sigue a la vista después de acreditar. */
  const [reenvio, setReenvio] = useState<EnvioReenvio | null>(null);

  const n = datos.traeTarjetaFisica ? Number(datos.visitasFisicas || '0') : 0;
  const tope = Math.max(0, programa.posiciones - 2);
  const pideEvidencia = n > 0 && n + 1 >= 5;
  const tieneContacto = datos.celular.trim() !== '' || datos.correo.trim() !== '';
  const tieneNombreDicho = datos.nombreDicho.trim().length >= 2;
  const hayFolio = datos.folio.trim() !== '';
  const tieneComprobante =
    validarComprobanteSinTarjeta({ folio: datos.folio, fotoTicketUrl: fotoTicket }) === null;
  const listo =
    datos.nombre.trim().length >= 2 &&
    datos.apellidoPaterno.trim().length >= 2 &&
    datos.apellidoMaterno.trim().length >= 1 &&
    tieneContacto &&
    tieneComprobante &&
    (!datos.traeTarjetaFisica || (n >= 1 && n <= tope)) &&
    (!pideEvidencia || (foto && datos.celular.trim() !== '' && datos.correo.trim() !== ''));

  const campo = (k: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDatos({ ...datos, [k]: e.target.value });

  const encabezado = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        onClick={onCancelar}
        className="inline-flex min-h-[40px] items-center gap-1 text-sm text-crust-dark underline underline-offset-4"
      >
        <Icono nombre="izquierda" width={16} height={16} /> Cancelar
      </button>
      <span className="text-sm font-semibold text-ink">Registrar visita sin tarjeta</span>
    </div>
  );

  const camposContacto = (
    <section className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
      <label className="grid gap-1.5 text-sm font-semibold text-ink">
        Nombre del cliente <span className="font-normal text-muted">(como lo diga)</span>
        <input
          value={datos.nombreDicho}
          onChange={campo('nombreDicho')}
          autoComplete="off"
          autoCapitalize="words"
          placeholder="Mariana López Ruiz"
          disabled={existente !== null}
          className={`${CAMPO} disabled:bg-cream`}
        />
      </label>
      <h3 className="text-base font-semibold text-ink">
        Contacto <span className="font-normal text-muted">(al menos uno; el que prefiera)</span>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Celular
          <input
            value={datos.celular}
            onChange={campo('celular')}
            inputMode="tel"
            autoComplete="off"
            placeholder="228 000 0000"
            disabled={existente !== null}
            className={`${CAMPO} font-mono disabled:bg-cream`}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-ink">
          Correo
          <input
            value={datos.correo}
            onChange={campo('correo')}
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="nombre@correo.com"
            disabled={existente !== null}
            className={`${CAMPO} disabled:bg-cream`}
          />
        </label>
      </div>
      {existente !== null && (
        <button
          type="button"
          onClick={() => {
            setExistente(null);
            setError(null);
            setAcceso(null);
            setReenvio(null);
          }}
          className="justify-self-start text-xs text-crust-dark underline underline-offset-4"
        >
          Cambiar nombre o contacto
        </button>
      )}
    </section>
  );

  /** Folio y foto del ticket: el comprobante de compra, obligatorio sin tarjeta. */
  const comprobante = (
    <section className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
      <h3 className="text-base font-semibold text-ink">
        Comprobante de compra{' '}
        <span className="font-normal text-muted">
          {fotosActivas ? '(folio o foto; al menos uno)' : '(folio del ticket)'}
        </span>
      </h3>
      <label className="grid gap-1.5 text-sm font-semibold text-ink">
        Folio del ticket
        <input
          value={datos.folio}
          onChange={campo('folio')}
          autoComplete="off"
          placeholder="C2-12044"
          className={`${CAMPO} font-mono sm:max-w-xs`}
        />
      </label>
      {fotosActivas && (
        <FotoTicket sucursalSlug={sucursal.slug} obligatoria={!hayFolio} onCambio={setFotoTicket} />
      )}
      <p className="text-xs text-muted">
        Sin la tarjeta del cliente, la visita solo se acredita con su ticket de hoy. Un mismo folio
        no puede acreditarse dos veces.
      </p>
    </section>
  );

  // Paso 1: ¿de quién es este contacto?
  if (existente === null) {
    return (
      <form
        className="grid max-w-2xl gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          iniciar(async () => {
            const r = await buscarPorContacto({
              sucursalSlug: sucursal.slug,
              nombre: datos.nombreDicho,
              celular: datos.celular,
              correo: datos.correo,
            });
            if (!r.ok) {
              setError(r.error);
              return;
            }
            if (r.tarjeta) {
              setExistente(r.tarjeta);
              setAcceso(r.acceso);
              return;
            }
            // Sin tarjeta: el nombre dicho se reparte en los tres campos del alta.
            setDatos({ ...datos, ...repartirNombre(datos.nombreDicho) });
            setExistente('nueva');
          });
        }}
      >
        {encabezado}
        {!sucursal.participa && (
          <Aviso tono="atencion" titulo="Esta sucursal todavía no participa">
            No se pueden acreditar visitas hasta que administración la incorpore.
          </Aviso>
        )}
        {camposContacto}
        <p className="text-xs text-muted">
          Pregunta su nombre y su celular o correo. En el siguiente paso se pide el ticket de hoy:
          sin tarjeta a la vista, la visita se acredita solo con comprobante de compra.
        </p>
        {error && <Aviso tono="error">{error}</Aviso>}
        <button
          type="submit"
          disabled={!tieneNombreDicho || !tieneContacto || ocupado || !sucursal.participa}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm bg-ink px-6 font-semibold text-cream hover:bg-ink-soft disabled:opacity-40"
        >
          {ocupado ? 'Buscando…' : 'Continuar'}
        </button>
      </form>
    );
  }

  // Ya tiene tarjeta: cotejar el nombre, pedir el comprobante y acreditar.
  if (existente !== 'nueva') {
    const t = existente;
    const coincide = nombresCoinciden(datos.nombreDicho, t.nombre);
    const reenviar = (
      <ReenviarAcceso
        codigo={t.codigo}
        sucursalSlug={sucursal.slug}
        tieneCelular={t.tieneCelular}
        tieneCorreo={t.tieneCorreo}
        abrioTarjeta={acceso?.abrioTarjeta ?? null}
        enviado={reenvio}
        onEnviado={setReenvio}
      />
    );
    if (visita) {
      const bien = visita.tipo === 'ACREDITADA';
      return (
        <div className="grid max-w-2xl gap-4">
          {encabezado}
          {bien ? (
            <Aviso
              tono="ok"
              titulo={`Visita acreditada a ${t.nombre ?? t.codigo}`}
              icono="palomita"
            >
              {visita.antes.estampas} → {visita.despues.estampas} de {programa.posiciones} sellos
              {visita.premios.length > 0
                ? ' · ¡ganó un premio! Entrégalo con «Entregar premio».'
                : '.'}
            </Aviso>
          ) : visita.tipo === 'RECHAZADA' && visita.texto ? (
            <Aviso tono="atencion" titulo={visita.texto.titulo}>
              {visita.texto.detalle}
            </Aviso>
          ) : visita.tipo === 'ERROR' ? (
            <Aviso tono="error">{visita.error}</Aviso>
          ) : (
            <Aviso tono="atencion" titulo="La visita quedó pendiente de revisión">
              El dueño o la gerencia la confirmará.
            </Aviso>
          )}
          {reenviar}
          <button
            type="button"
            onClick={onTerminar}
            className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-ink px-6 font-semibold text-cream hover:bg-ink-soft"
          >
            Listo, siguiente cliente
          </button>
        </div>
      );
    }
    return (
      <div className="grid max-w-2xl gap-4">
        {encabezado}
        {camposContacto}
        <section className="grid gap-3 rounded-lg border-[1.5px] border-ink bg-cream p-4">
          <h3 className="text-base font-semibold text-ink">
            Ya tiene tarjeta: confirma con la persona
          </h3>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Nombre registrado</dt>
            <dd className="font-semibold text-ink">{t.nombre ?? 'Sin nombre registrado'}</dd>
            <dt className="text-muted">Dijo llamarse</dt>
            <dd className="text-ink">{datos.nombreDicho.trim()}</dd>
            <dt className="text-muted">Contacto</dt>
            <dd className="font-mono">{t.contacto}</dd>
            <dt className="text-muted">Tarjeta</dt>
            <dd>
              <span className="font-mono">{t.codigo}</span> · {t.estampas} de {t.posiciones} sellos
            </dd>
          </dl>
          {coincide === false && (
            <Aviso tono="atencion" titulo="El nombre no coincide con la tarjeta">
              Pregunta de nuevo o pide que muestre su tarjeta. Si es la misma persona (apodo, error
              al capturar), puedes continuar: el nombre dicho queda anotado.
            </Aviso>
          )}
          {coincide === null && t.nombre === null && (
            <Aviso tono="info">
              La tarjeta no tiene nombre registrado; el nombre dicho queda anotado en la visita.
            </Aviso>
          )}
          {t.acumuloHoyAqui && (
            <Aviso tono="atencion" titulo="Ya acumuló hoy aquí">
              Esta tarjeta ya sumó una visita en esta sucursal hoy. Se acredita una por día.
            </Aviso>
          )}
        </section>
        {comprobante}
        {error && <Aviso tono="error">{error}</Aviso>}
        <button
          type="button"
          disabled={ocupado || t.acumuloHoyAqui || !sucursal.participa || !tieneComprobante}
          onClick={() =>
            iniciar(async () => {
              setError(null);
              const r = await acreditarSinTarjeta({
                codigo: t.codigo,
                sucursalSlug: sucursal.slug,
                nombreDicho: datos.nombreDicho,
                folio: datos.folio,
                fotoTicketUrl: fotoTicket,
                fecha: hoy,
              });
              if (r.tipo === 'ERROR') {
                setError(r.error);
                return;
              }
              setVisita(r);
            })
          }
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm bg-ink px-6 font-semibold text-cream hover:bg-ink-soft disabled:opacity-40"
        >
          <Icono nombre="palomita" />
          {ocupado ? 'Acreditando…' : 'Es esa persona: acreditar visita de hoy'}
        </button>
        {reenviar}
        {sucursal.participa && (
          <MigrarFisica
            tarjeta={t}
            sucursalSlug={sucursal.slug}
            programa={programa}
            onListo={setExistente}
          />
        )}
      </div>
    );
  }

  if (resultado) {
    const t = resultado.tarjeta;
    const b = resultado.bienvenida;
    return (
      <div className="grid max-w-2xl gap-4">
        <Aviso tono="ok" titulo={`${t.nombre} ya es cliente leal`} icono="palomita">
          Tarjeta <span className="font-mono">{t.codigo}</span> · {t.estampas}{' '}
          {t.estampas === 1 ? 'sello' : 'sellos'}
          {resultado.visitasMigradas > 0
            ? ` (${resultado.visitasMigradas} de su tarjeta física + la de hoy)`
            : ' (la visita de hoy)'}
          .
        </Aviso>
        {resultado.visitaHoy !== 'ACREDITADA' && (
          <Aviso
            tono="atencion"
            titulo={resultado.visitaTexto?.titulo ?? 'La visita de hoy no se acreditó'}
          >
            {resultado.visitaTexto?.detalle ??
              'La tarjeta se creó sin la visita de hoy. Si corresponde, regístrala con «Registrar visita».'}
          </Aviso>
        )}

        {b ? (
          <section className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
            <h3 className="text-base font-semibold text-ink">Cómo le llega su tarjeta</h3>
            {b.correo === 'ENVIADO' && (
              <p className="flex items-start gap-2 text-sm text-ink-soft">
                <Icono nombre="correo" className="mt-0.5 flex-none text-disponible" />
                Le enviamos su enlace personal por correo: no vence y sirve en cualquier celular.
                Dile que si no lo ve, revise la carpeta de no deseados.
              </p>
            )}
            {b.correo === 'FALLO' && (
              <Aviso tono="atencion">
                El correo no salió. Usa el WhatsApp o el QR de abajo para darle el acceso.
              </Aviso>
            )}
            {b.whatsapp && (
              <a
                href={b.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                // Se anota que el enlace salió por WhatsApp al celular
                // registrado: al abrirlo, el celular queda verificado.
                onClick={() => {
                  void marcarBienvenidaPorWhatsApp(b.url).catch(() => undefined);
                }}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm bg-[#1f8f5a] px-5 font-semibold text-cream hover:bg-[#19764a]"
              >
                Enviar acceso por WhatsApp
              </a>
            )}
            <details className="text-sm text-ink-soft">
              <summary className="cursor-pointer text-crust-dark underline underline-offset-4">
                O que lo escanee aquí mismo
              </summary>
              <div className="mt-3 grid justify-items-center gap-2">
                <div
                  className="w-44 rounded-md bg-white p-2"
                  dangerouslySetInnerHTML={{ __html: b.svg }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(b.url);
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 2500);
                    } catch {
                      /* sin portapapeles: el QR basta */
                    }
                  }}
                  className="text-xs text-crust-dark underline underline-offset-4"
                >
                  {copiado ? 'Enlace copiado' : 'Copiar enlace'}
                </button>
                <p className="text-xs text-muted">
                  Es su enlace personal: no vence. Que guarde la tarjeta en su pantalla de inicio al
                  abrirla.
                </p>
              </div>
            </details>
          </section>
        ) : (
          <Aviso tono="atencion">
            No se pudo generar el enlace de acceso (se pidieron varios en poco tiempo). Repón su
            acceso desde «Reponer su acceso» en unos minutos.
          </Aviso>
        )}

        <button
          type="button"
          onClick={onTerminar}
          className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-ink px-6 font-semibold text-cream hover:bg-ink-soft"
        >
          Listo, siguiente cliente
        </button>
      </div>
    );
  }

  return (
    <form
      className="grid max-w-2xl gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        iniciar(async () => {
          const r = await registrarNuevoCliente({
            sucursalSlug: sucursal.slug,
            nombre: datos.nombre,
            apellidoPaterno: datos.apellidoPaterno,
            apellidoMaterno: datos.apellidoMaterno,
            celular: datos.celular,
            correo: datos.correo,
            folio: datos.folio,
            fotoTicketUrl: fotoTicket,
            traeTarjetaFisica: datos.traeTarjetaFisica,
            visitasFisicas: datos.visitasFisicas,
            fotoTarjetaUrl: foto,
          });
          if (!r.ok) {
            setError(r.error);
            return;
          }
          setResultado(r);
        });
      }}
    >
      {encabezado}

      {!sucursal.participa && (
        <Aviso tono="atencion" titulo="Esta sucursal todavía no participa">
          No se pueden dar de alta clientes hasta que administración la incorpore.
        </Aviso>
      )}

      {camposContacto}
      <Aviso tono="info" titulo="Sin tarjeta todavía">
        Ese contacto no tiene tarjeta. Revisa el nombre completo y captura el ticket de hoy: se crea
        con la visita acumulada.
      </Aviso>

      <section className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
        <h3 className="text-base font-semibold text-ink">Nombre completo</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-ink">
            Nombre(s)
            <input
              value={datos.nombre}
              onChange={campo('nombre')}
              autoComplete="off"
              autoCapitalize="words"
              className={CAMPO}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-ink">
            Apellido paterno
            <input
              value={datos.apellidoPaterno}
              onChange={campo('apellidoPaterno')}
              autoComplete="off"
              autoCapitalize="words"
              className={CAMPO}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-ink">
            Apellido materno
            <input
              value={datos.apellidoMaterno}
              onChange={campo('apellidoMaterno')}
              autoComplete="off"
              autoCapitalize="words"
              placeholder="— si no tiene"
              className={CAMPO}
            />
          </label>
        </div>
      </section>

      <p className="text-xs text-muted">
        Dile al cliente que acepta los términos del programa y que recibirá promociones (puede darse
        de baja desde su tarjeta). Con celular, tú le mandas el acceso por WhatsApp al terminar; con
        correo, le llega solo.
      </p>

      {comprobante}

      <section className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={datos.traeTarjetaFisica}
            onChange={(e) => setDatos({ ...datos, traeTarjetaFisica: e.target.checked })}
            className="mt-0.5 h-5 w-5 flex-none accent-ink"
          />
          <span>
            <b className="block font-semibold">Trae tarjeta física con sellos</b>
            <span className="text-ink-soft">
              Sus visitas pasan a la tarjeta digital. Con la de hoy, máximo{' '}
              {programa.posiciones - 1} sellos en total ({tope} de la tarjeta física).
            </span>
          </span>
        </label>
        {datos.traeTarjetaFisica && (
          <div className="grid gap-3 border-t border-rule pt-3">
            <label className="grid gap-1.5 text-sm font-semibold text-ink">
              Visitas selladas
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={tope}
                value={datos.visitasFisicas}
                onChange={campo('visitasFisicas')}
                className={`${CAMPO} font-mono sm:max-w-[8rem]`}
              />
            </label>
            <FotoTarjetaFisica
              sucursalSlug={sucursal.slug}
              obligatoria={pideEvidencia}
              onCambio={setFoto}
            />
            {pideEvidencia && (
              <p className="text-xs text-ink-soft">
                A partir de 5 sellos en total se necesitan la foto de la tarjeta, el celular y el
                correo del cliente.
              </p>
            )}
          </div>
        )}
      </section>

      {error && <Aviso tono="error">{error}</Aviso>}

      <button
        type="submit"
        disabled={!listo || ocupado || !sucursal.participa}
        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-sm bg-ink px-6 font-semibold text-cream hover:bg-ink-soft disabled:opacity-40"
      >
        <Icono nombre="persona" />
        {ocupado ? 'Creando tarjeta…' : 'Crear tarjeta y acumular visita de hoy'}
      </button>
    </form>
  );
}
