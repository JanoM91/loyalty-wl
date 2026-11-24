import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import {
  TOPE_MENSAJES_POR_OMISION,
  estadoComercialDe,
  listarBitacoraPlataforma,
  listarPagos,
  obtenerNegocioEnLista,
  plantillaArcade,
  preciosDelServicio,
  solicitudesPrivadaPendientes,
  usoDeClubes,
} from '@wl/database';
import {
  TEXTO_MOTIVO,
  arcadeVigente,
  diasEnPausa,
  diasRestantesDePrueba,
  fechaDeBorrado,
  motivoDeLlamada,
  ultimaActividad,
} from '@wl/domain';

import { RUTA_CLUBES } from '@/lib/plataforma/panel';
import { textoDeAccion } from '@/lib/plataforma/bitacora';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { CamposPermisos } from '../FormPermisos';
import { BorrarClub, FormularioPago, InvitarDuenio } from '../FormulariosFicha';
import { MarcoPlataforma } from '../Marco';
import {
  arcadeActivo,
  arcadePermisos,
  mensajesAjustes,
  modalidad,
  prueba,
  suspender,
} from '../acciones';
import { AvisoDeAccion, ListaPagos, hace } from '../piezas';

export const metadata: Metadata = { title: 'Club' };
export const dynamic = 'force-dynamic';

const BOTON =
  'min-h-[44px] rounded-full border border-rule px-5 text-[15px] text-ink hover:border-ink';

const fecha = (iso: string | Date | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
        dateStyle: 'long',
      })
    : '';

const fechaHora = (d: Date) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/** Ficha de un negocio: sus direcciones, su estado y la invitación de su dueño. */
export default async function NegocioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enlace?: string; aviso?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [{ slug }, { enlace, aviso }] = await Promise.all([params, searchParams]);
  const fila = await obtenerNegocioEnLista(slug);
  if (!fila) notFound();
  const { negocio } = fila;

  const origen = (await headers()).get('x-wl-origen') ?? '';
  // Instalación privada: el negocio ocupa todo el dominio. Compartida: va en la ruta.
  const base = process.env.WL_NEGOCIO_UNICO ? origen : `${origen}/${negocio.slug}`;
  const privada = negocio.ajustes.plan === 'PRIVADA';
  const comercial = estadoComercialDe(negocio);
  const alta = negocio.ajustes.alta;
  const { pruebaVence, pagadoHasta } = negocio.ajustes;
  const conFechas = Boolean(alta || pruebaVence || pagadoHasta);
  const enPausa = diasEnPausa(pruebaVence, pagadoHasta);
  const borrarDesde = fechaDeBorrado(pruebaVence, pagadoHasta);
  const [precios, plantilla, pagos, uso, movimientos, [solicitud]] = await Promise.all([
    preciosDelServicio(),
    plantillaArcade(),
    listarPagos({ clubId: negocio.id, limite: 20 }),
    usoDeClubes([negocio.id]),
    listarBitacoraPlataforma({ clubId: negocio.id, limite: 8 }),
    solicitudesPrivadaPendientes([negocio.id]),
  ]);
  const usoClub = uso.get(negocio.id);
  const motivo = usoClub ? motivoDeLlamada(usoClub) : null;
  const ultima = usoClub ? ultimaActividad(usoClub) : null;
  const arcade = negocio.ajustes.arcade;
  const arcadeVence = arcade?.pagadoHasta ?? null;
  const arcadeAlDia = arcadeVigente(arcade);
  let arcadeEstado = 'Sin activar. Al registrar el primer pago se activa con la plantilla.';
  if (arcade && arcadeVence) {
    const vencido = Date.parse(arcadeVence) <= Date.now();
    arcadeEstado = vencido
      ? `Vencido el ${fecha(arcadeVence)}: los clientes no pueden jugar.`
      : arcade.activo
        ? `Activo, pagado hasta el ${fecha(arcadeVence)}.`
        : `Apagado (pagado hasta el ${fecha(arcadeVence)}).`;
  }

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="clubes"
      enTarjeta
      miga={{ texto: 'Clubes', ruta: RUTA_CLUBES }}
      titulo={negocio.nombre}
      descripcion={`${privada ? 'Privada' : 'Lite'}${negocio.activo ? '' : ', suspendido'}. ${fila.sucursales} ${fila.sucursales === 1 ? 'sucursal' : 'sucursales'}, ${fila.tarjetas} ${fila.tarjetas === 1 ? 'tarjeta' : 'tarjetas'}, ${fila.usuarios} ${fila.usuarios === 1 ? 'cuenta' : 'cuentas'} de panel.`}
    >
      <div className="grid max-w-3xl gap-10">
        <AvisoDeAccion aviso={aviso} />
        {enlace && (
          <section className="grid gap-3 rounded-xl bg-ink p-6 text-cream">
            <h2 className="text-2xl">Enlace para el dueño</h2>
            <p className="text-[15px] text-cream/80">
              Mándaselo tú: sirve una sola vez y con él fija su contraseña. No se vuelve a mostrar;
              si se pierde, genera otro aquí abajo.
            </p>
            <code className="rounded-md bg-cream/10 px-3 py-2.5 text-[14px] break-all">
              {`${base}/admin/contrasena/${enlace}`}
            </code>
          </section>
        )}

        {conFechas && (
          <section className="grid gap-3">
            <h2 className="text-xl text-ink">Prueba y pago</h2>
            <p className="text-[15px] text-ink">
              {comercial === 'PRUEBA' &&
                `En prueba: vence el ${fecha(pruebaVence)} (${diasRestantesDePrueba(pruebaVence)} días).`}
              {comercial === 'ACTIVO' &&
                (pagadoHasta
                  ? `Pagado hasta el ${fecha(pagadoHasta)}.`
                  : 'Activo sin límite (sin fecha de pago).')}
              {comercial === 'PAUSADO' &&
                `En pausa desde hace ${enPausa} ${enPausa === 1 ? 'día' : 'días'}: ${pagadoHasta ? 'no renovó' : 'la prueba venció'}. La caja no sella y no se crean tarjetas. Se puede borrar desde el ${fecha(borrarDesde)}.`}
            </p>
            {alta && (
              <p className="text-[15px] text-muted">
                Alta desde /{alta.origen || 'empezar'} · giro: {alta.giro} · {alta.correo} ·{' '}
                <a
                  href={`https://wa.me/${alta.whatsapp}`}
                  className="text-ink underline underline-offset-4"
                >
                  WhatsApp +{alta.whatsapp}
                </a>
                {alta.legal ? ` · aceptó términos del ${alta.legal}` : ''}
              </p>
            )}
            <FormularioPago slug={negocio.slug} concepto="LITE" precios={precios.lite} />
            <form action={prueba}>
              <input type="hidden" name="slug" value={negocio.slug} />
              <button type="submit" className={BOTON}>
                Dar 7 días de prueba desde hoy
              </button>
            </form>
            <p className="max-w-prose text-[13px] text-muted">
              Cada pago suma un mes o un año a partir del fin del periodo pagado (o de hoy, si ya
              venció) y queda en Ingresos. Dar 7 días quita el periodo pagado y deja el club en
              prueba.
            </p>
          </section>
        )}

        {!conFechas && (
          <details className="grid gap-3 rounded-xl border border-rule p-6">
            <summary className="min-h-[44px] cursor-pointer py-2 text-[15px] font-semibold text-ink">
              Registrar un pago de Lite
            </summary>
            <p className="mt-2 mb-3 max-w-prose text-[14px] text-ink">
              Este club está activo sin límite (lo dio de alta Exkalibur). Al registrar un pago
              queda pagado hasta el fin del periodo y, si no renueva, se pausa como los demás.
            </p>
            <FormularioPago slug={negocio.slug} concepto="LITE" precios={precios.lite} />
          </details>
        )}

        <section id="pagos" className="grid gap-3">
          <h2 className="text-xl text-ink">Pagos registrados</h2>
          <ListaPagos pagos={pagos} conClub={false} />
        </section>

        <section id="actividad" className="grid gap-3">
          <h2 className="text-xl text-ink">Actividad</h2>
          {usoClub ? (
            <>
              {motivo && (
                <p className="rounded-[14px] border-[1.5px] border-[#E0B45C] bg-[#FFF8E6] px-4 py-3 text-[15px] text-[#5B3B00]">
                  <b>Para llamar:</b> {TEXTO_MOTIVO[motivo]}.
                  {alta?.whatsapp && (
                    <>
                      {' '}
                      <a
                        href={`https://wa.me/${alta.whatsapp}`}
                        className="font-semibold text-ink underline underline-offset-4"
                      >
                        Escribirle por WhatsApp
                      </a>
                    </>
                  )}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-3 text-[15px] sm:grid-cols-4">
                {[
                  ['Visitas 7 días', usoClub.visitas7.toLocaleString('es-MX')],
                  ['Visitas 30 días', usoClub.visitas30.toLocaleString('es-MX')],
                  ['Tarjetas nuevas 30 días', usoClub.tarjetas30.toLocaleString('es-MX')],
                  ['Premios entregados 30 días', usoClub.premios30.toLocaleString('es-MX')],
                  ['Última visita', hace(usoClub.ultimaVisita)],
                  ['Última tarjeta', hace(usoClub.ultimaTarjeta)],
                  ['Último acceso al panel', hace(usoClub.ultimoAcceso)],
                  ['Última actividad', hace(ultima)],
                ].map(([etiqueta, valor]) => (
                  <div key={etiqueta} className="grid gap-0.5 border-t border-rule pt-2">
                    <dt className="text-[13px] text-muted">{etiqueta}</dt>
                    <dd className="font-semibold text-ink tabular-nums">{valor}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-[15px] text-muted">Sin datos de uso.</p>
          )}
        </section>

        {conFechas && comercial !== 'ACTIVO' && (
          <section className="grid gap-3 rounded-xl border border-agotado/40 p-6">
            <h2 className="text-xl text-ink">Borrar este club</h2>
            <p className="max-w-prose text-[15px] text-ink">
              Borra el club, sus {fila.tarjetas} {fila.tarjetas === 1 ? 'tarjeta' : 'tarjetas'}, su
              historial y las cuentas de su equipo. No tiene vuelta atrás.
              {comercial === 'PAUSADO' && enPausa < 30
                ? ` Ojo: lleva ${enPausa} ${enPausa === 1 ? 'día' : 'días'} en pausa; los términos prometen conservarlo 30.`
                : ''}
            </p>
            <BorrarClub slug={negocio.slug} />
          </section>
        )}

        <section id="arcade" className="grid gap-4 rounded-xl border border-rule p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl text-ink">Arcade del club</h2>
            {arcadeAlDia && (
              <span className="rounded-full bg-ink px-3 py-1 text-[13px] font-semibold text-cream">
                Los clientes juegan
              </span>
            )}
          </div>
          <p className="text-[15px] text-ink">{arcadeEstado}</p>
          <FormularioPago slug={negocio.slug} concepto="ARCADE" precios={precios.arcade} />
          <div className="flex flex-wrap gap-3">
            {arcade && (
              <form action={arcadeActivo}>
                <input type="hidden" name="slug" value={negocio.slug} />
                <input type="hidden" name="activo" value={arcade.activo ? '0' : '1'} />
                <button type="submit" className={BOTON}>
                  {arcade.activo ? 'Apagar' : 'Encender'}
                </button>
              </form>
            )}
          </div>
          <details className="grid gap-4">
            <summary className="min-h-[44px] cursor-pointer py-2 text-[15px] font-semibold text-ink">
              Permisos de este club{arcade ? '' : ' (hoy, los de la plantilla)'}
            </summary>
            <form action={arcadePermisos} className="mt-3 grid gap-5">
              <input type="hidden" name="slug" value={negocio.slug} />
              <CamposPermisos p={arcade ?? plantilla} />
              <div>
                <button type="submit" className={BOTON}>
                  Guardar permisos
                </button>
              </div>
            </form>
          </details>
          <p className="max-w-prose text-[13px] text-muted">
            Cada pago suma un mes o un año al periodo del Arcade, aparte del de Lite. El dueño
            configura juegos, retos y premios dentro de estos permisos desde su panel.
          </p>
        </section>

        <section id="mensajes" className="grid gap-4 rounded-xl border border-rule p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl text-ink">Mensajes a clientes</h2>
            {negocio.ajustes.mensajes?.activo && (
              <span className="rounded-full bg-ink px-3 py-1 text-[13px] font-semibold text-cream">
                Encendido
              </span>
            )}
          </div>
          <form action={mensajesAjustes} className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="slug" value={negocio.slug} />
            <label className="flex min-h-[44px] items-center gap-2 text-[15px] text-ink">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={Boolean(negocio.ajustes.mensajes?.activo)}
                className="h-5 w-5"
              />
              El dueño puede mandar correos
            </label>
            <label className="grid gap-1.5 text-[14px] text-muted">
              Correos al mes
              <input
                name="tope"
                type="number"
                min={0}
                max={100000}
                defaultValue={negocio.ajustes.mensajes?.topeMensual ?? TOPE_MENSAJES_POR_OMISION}
                className="min-h-[44px] w-32 border border-rule bg-cream px-3.5 text-[15px] text-ink"
              />
            </label>
            <button type="submit" className={BOTON}>
              Guardar
            </button>
          </form>
          <p className="max-w-prose text-[13px] text-muted">
            Cada destinatario cuenta un correo. Solo llega a clientes que aceptaron promociones y
            verificaron su correo; un mensaje al día como máximo. Revisa que el plan de Resend
            alcance para la suma de todos los clubes.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl text-ink">Direcciones</h2>
          <dl className="grid gap-2 text-[15px]">
            {[
              ['Programa (clientes)', `${base}/lealtad`],
              ['Panel del negocio', `${base}/admin`],
            ].map(([nombre, url]) => (
              <div key={nombre} className="grid gap-0.5 border-t border-rule pt-2">
                <dt className="text-muted">{nombre}</dt>
                <dd>
                  <a href={url} className="break-all text-ink underline underline-offset-4">
                    {url}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl text-ink">Invitar al dueño</h2>
          <InvitarDuenio slug={negocio.slug} />
          <p className="text-[13px] text-muted">
            Si el correo ya tiene cuenta en este negocio, el enlace le sirve para elegir una
            contraseña nueva.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl text-ink">Modalidad y estado</h2>
          {solicitud && (
            <p
              role="status"
              className="max-w-prose rounded-[14px] border-[1.5px] border-[#E0B45C] bg-[#FFF8E6] px-4 py-3 text-[15px] text-ink"
            >
              <b className="font-semibold">Pidió pasar a Privada</b> el {fecha(solicitud.fecha)}
              {solicitud.quien ? ` (${solicitud.quien})` : ''}.
              {solicitud.nota ? ` Nota: «${solicitud.nota}».` : ''} Después de la demo y el acuerdo,
              usa «Pasar a Privada».
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <form action={modalidad}>
              <input type="hidden" name="slug" value={negocio.slug} />
              <input type="hidden" name="plan" value={privada ? 'LITE' : 'PRIVADA'} />
              <button type="submit" className={BOTON}>
                Pasar a {privada ? 'Lite' : 'Privada'}
              </button>
            </form>
            <form action={suspender}>
              <input type="hidden" name="slug" value={negocio.slug} />
              <input type="hidden" name="activo" value={negocio.activo ? '0' : '1'} />
              <button type="submit" className={BOTON}>
                {negocio.activo ? 'Suspender' : 'Reactivar'}
              </button>
            </form>
          </div>
          <p className="max-w-prose text-[13px] text-muted">
            Suspender cierra su programa y su panel sin borrar nada; reactivar lo deja como estaba.
          </p>
        </section>

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl text-ink">Movimientos en este club</h2>
            <a
              href={`/plataforma/bitacora?club=${negocio.id}`}
              className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-ink underline underline-offset-4"
            >
              Ver todos
            </a>
          </div>
          {movimientos.length === 0 ? (
            <p className="text-[15px] text-muted">Nadie del equipo ha hecho cambios aquí.</p>
          ) : (
            <ul className="grid text-[15px]">
              {movimientos.map((m) => (
                <li key={m.id} className="grid gap-0.5 border-t border-rule py-2.5">
                  <span className="text-ink">{textoDeAccion(m.accion)}</span>
                  <span className="text-[13px] text-muted">
                    {m.actor} · {fechaHora(m.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </MarcoPlataforma>
  );
}
