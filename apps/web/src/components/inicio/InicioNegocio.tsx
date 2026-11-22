import type { Negocio } from '@wl/database';
import type { ProgramaLealtad } from '@wl/domain';

import { CargandoAlNavegar } from '@/components/CargandoAlNavegar';
import { LogoMarca } from '@/components/Marca';
import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';

export interface SucursalInicio {
  readonly nombre: string;
  readonly direccion: string;
  readonly telefono: string | null;
}

/**
 * Página de inicio de un negocio con instalación privada: su dominio abre
 * aquí. Presenta el negocio y lleva a su programa de lealtad.
 */
export function InicioNegocio({
  negocio,
  programa,
  sucursales,
}: {
  negocio: Negocio;
  programa: ProgramaLealtad;
  sucursales: readonly SucursalInicio[];
}) {
  const hitos = [...programa.hitos].sort((a, b) => a.posicion - b.posicion);
  const mayor = hitos[hitos.length - 1];
  const { contacto, redes } = negocio.marca;
  const muestra = Math.max(1, Math.min((hitos[0]?.posicion ?? 3) - 1, 3));

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20">
      <CargandoAlNavegar variante="negocio" />
      <header className="flex items-center justify-between gap-4 py-5">
        <LogoMarca sobre="claro" className="h-9 text-[21px]" />
        <a
          href="/lealtad/entrar"
          className="rounded-full border border-rule px-4 py-2 text-[15px] text-ink hover:border-ink"
        >
          Mi tarjeta
        </a>
      </header>

      <main id="contenido" className="grid gap-20 pt-10">
        <section className="grid items-center gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="grid gap-6">
            <h1 className="text-[clamp(2.75rem,8vw,5rem)] text-balance">
              {negocio.marca.frase || negocio.nombre}
            </h1>
            <p className="max-w-[40ch] text-[18px] text-muted">
              {mayor
                ? `Cada visita suma un sello. En la ${mayor.posicion}, ${mayor.nombre.toLowerCase()} va por nuestra cuenta.`
                : 'Cada visita suma un sello en tu tarjeta.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/lealtad/alta"
                className="inline-flex min-h-[56px] items-center rounded-full bg-ink px-8 text-[17px] font-semibold text-cream"
              >
                Crear mi tarjeta
              </a>
              <a
                href="/lealtad/terminos"
                className="inline-flex min-h-[56px] items-center rounded-full px-5 text-[16px] text-ink underline decoration-rule decoration-2 underline-offset-4"
              >
                Cómo funciona
              </a>
            </div>
          </div>
          <div aria-hidden="true" className="mx-auto w-full max-w-sm">
            <TarjetaSellos
              datos={{ estampas: muestra, ciclo: 1, nombre: 'Así se ve' }}
              programa={programa}
            />
          </div>
        </section>

        {sucursales.length > 0 && (
          <section className="grid gap-6">
            <h2 className="text-3xl">Dónde estamos</h2>
            <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {sucursales.map((s) => (
                <li key={s.nombre} className="grid gap-1 border-t border-rule pt-4 text-[15px]">
                  <b className="text-[17px] font-semibold text-ink">{s.nombre}</b>
                  {s.direccion ? <span className="text-muted">{s.direccion}</span> : null}
                  {s.telefono ? (
                    <a href={`tel:${s.telefono}`} className="text-ink">
                      {s.telefono}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="mt-20 flex flex-wrap gap-x-6 gap-y-2 border-t border-rule pt-6 text-[14px] text-muted">
        <span>{negocio.marca.legal.razonSocial ?? negocio.nombre}</span>
        {contacto.whatsapp ? <a href={`https://wa.me/${contacto.whatsapp}`}>WhatsApp</a> : null}
        {redes.instagram ? (
          <a href={`https://instagram.com/${redes.instagram}`}>Instagram</a>
        ) : null}
        {contacto.correo ? <a href={`mailto:${contacto.correo}`}>{contacto.correo}</a> : null}
        <a href="/lealtad/terminos">Términos del programa</a>
        <a href="/lealtad/privacidad">Aviso de privacidad</a>
      </footer>
    </div>
  );
}
