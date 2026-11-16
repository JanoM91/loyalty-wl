import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { listarNegocios } from '@wl/database';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { modalidad, reinvitar, suspender } from '../acciones';

export const metadata: Metadata = { title: 'Negocio' };
export const dynamic = 'force-dynamic';

const BOTON =
  'min-h-[44px] rounded-full border border-rule px-5 text-[15px] text-ink hover:border-ink';

/** Ficha de un negocio: sus direcciones, su estado y la invitación de su dueño. */
export default async function NegocioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ enlace?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [{ slug }, { enlace }] = await Promise.all([params, searchParams]);
  const fila = (await listarNegocios()).find((n) => n.negocio.slug === slug);
  if (!fila) notFound();
  const { negocio } = fila;

  const origen = (await headers()).get('x-wl-origen') ?? '';
  // Instalación privada: el negocio ocupa todo el dominio. Compartida: va en la ruta.
  const base = process.env.WL_NEGOCIO_UNICO ? origen : `${origen}/${negocio.slug}`;
  const privada = negocio.ajustes.plan === 'PRIVADA';

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
