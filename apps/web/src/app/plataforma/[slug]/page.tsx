import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { estadoComercialDe, listarNegocios } from '@wl/database';
import { diasEnPausa, diasRestantesDePrueba, fechaDeBorrado } from '@wl/domain';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { borrar, modalidad, pago, prueba, reinvitar, suspender } from '../acciones';

export const metadata: Metadata = { title: 'Negocio' };
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

/** Ficha de un negocio: sus direcciones, su estado y la invitación de su dueño. */
export default async function NegocioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enlace?: string; borrar?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [{ slug }, { enlace, borrar: borrarError }] = await Promise.all([params, searchParams]);
  const fila = (await listarNegocios()).find((n) => n.negocio.slug === slug);
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

  return (
    <MarcoPlataforma
      sesion={sesion}
      titulo={negocio.nombre}
      descripcion={`${privada ? 'Privada' : 'Lite'}${negocio.activo ? '' : ', suspendido'}. ${fila.sucursales} ${fila.sucursales === 1 ? 'sucursal' : 'sucursales'}, ${fila.tarjetas} ${fila.tarjetas === 1 ? 'tarjeta' : 'tarjetas'}, ${fila.usuarios} ${fila.usuarios === 1 ? 'cuenta' : 'cuentas'} de panel.`}
    >
      <div className="grid max-w-3xl gap-10">
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
            <div className="flex flex-wrap gap-3">
              {(['MES', 'ANIO'] as const).map((periodo) => (
                <form key={periodo} action={pago}>
                  <input type="hidden" name="slug" value={negocio.slug} />
                  <input type="hidden" name="periodo" value={periodo} />
                  <button type="submit" className={BOTON}>
                    {periodo === 'MES' ? 'Registrar pago de un mes' : 'Registrar pago de un año'}
                  </button>
                </form>
              ))}
              <form action={prueba}>
                <input type="hidden" name="slug" value={negocio.slug} />
                <button type="submit" className={BOTON}>
                  Dar 7 días de prueba desde hoy
                </button>
              </form>
            </div>
            <p className="max-w-prose text-[13px] text-muted">
              Cada pago suma un mes o un año a partir del fin del periodo pagado (o de hoy, si ya
              venció). Dar 7 días quita el periodo pagado y deja el club en prueba.
            </p>
          </section>
        )}

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
            {borrarError && (
              <p className="text-[15px] font-semibold text-agotado">
                No se borró: escribe la dirección exacta del club.
              </p>
            )}
            <form action={borrar} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="slug" value={negocio.slug} />
              <label className="grid gap-1.5 text-[14px] text-muted">
                Para confirmar, escribe «{negocio.slug}»
                <input
                  name="confirmacion"
                  required
                  autoComplete="off"
                  className="min-h-[44px] border border-rule bg-cream px-3.5 text-[15px] text-ink"
                />
              </label>
              <button
                type="submit"
                className="min-h-[44px] rounded-full bg-agotado px-5 text-[15px] font-semibold text-cream"
              >
                Borrar para siempre
              </button>
            </form>
          </section>
        )}

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
          <form action={reinvitar} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="slug" value={negocio.slug} />
            <label className="grid gap-1.5 text-[14px] text-muted">
              Correo
              <input
                name="email"
                type="email"
                required
                className="min-h-[44px] border border-rule bg-cream px-3.5 text-[15px] text-ink"
              />
            </label>
            <button type="submit" className={BOTON}>
              Generar enlace
            </button>
          </form>
          <p className="text-[13px] text-muted">
            Si el correo ya tiene cuenta en este negocio, el enlace le sirve para elegir una
            contraseña nueva.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="text-xl text-ink">Modalidad y estado</h2>
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
      </div>
    </MarcoPlataforma>
  );
}
