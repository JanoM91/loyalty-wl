import type { ProgramaLealtad } from '@wl/domain';

import { LogoMarca } from '@/components/Marca';

/**
 * Portada del programa: lo que ve quien escanea el código del mostrador.
 *
 * En diez segundos tiene que quedar claro qué se gana, cómo y que no hay que
 * instalar nada. El botón principal crea la tarjeta; el secundario es la
 * entrada para quien ya tiene una (cambió de celular, cerró sesión, etc.).
 */
export function Portada({
  sucursal,
  programa,
  frase,
}: {
  sucursal?: { slug: string; nombre: string } | null;
  programa: ProgramaLealtad;
  /** Frase de la marca, bajo el logotipo. */
  frase?: string | null;
}) {
  const hitos = [...programa.hitos].sort((a, b) => a.posicion - b.posicion);
  const [primero, segundo] = hitos;
  const alta = sucursal ? `/lealtad/alta?sucursal=${sucursal.slug}` : '/lealtad/alta';

  return (
    <section className="-mx-4 -mt-5 grid justify-items-center gap-6 bg-ink px-6 pt-8 pb-9 text-center text-cream">
      <LogoMarca sobre="oscuro" className="h-28 text-4xl" />
      {frase ? <p className="-mt-3 text-sm text-cream/70">{frase}</p> : null}

      <div className="grid gap-2.5">
        <h1 className="text-3xl leading-tight text-balance">Tu visita tiene recompensa</h1>
        <p className="mx-auto max-w-[32ch] text-[15.5px] text-cream/85">
          Suma una estampa en cada compra. Con {primero?.posicion} te regalamos{' '}
          {primero?.nombre.toLowerCase()}
          {segundo ? ` y con ${segundo.posicion}, ${segundo.nombre.toLowerCase()}` : ''}.
        </p>
      </div>

      <div aria-hidden="true" className="flex gap-1.5">
        {Array.from({ length: programa.posiciones }, (_, i) => (
          <span
            key={i}
            className={`h-5 w-5 rounded-full ${i < 3 ? 'bg-crust' : programa.hitos.some((h) => h.posicion === i + 1) ? 'border-[1.5px] border-crust-light' : 'border-[1.5px] border-dashed border-cream/35'}`}
          />
        ))}
      </div>

      <ol className="grid w-full gap-3 text-left text-sm text-cream/80">
        {[
          ['Muestra tu código en caja', 'Desde el navegador de tu celular, sin instalar nada.'],
          [
            'Suma una estampa por visita',
            'Una por sucursal y día, en cualquiera de nuestras sucursales.',
          ],
          ['Canjea tu premio en caja', 'Tus estampas y premios no vencen.'],
        ].map(([titulo, texto], i) => (
          <li key={titulo} className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full border-[1.5px] border-crust-light font-mono text-[13px] font-semibold text-crust-light">
              {i + 1}
            </span>
            <span>
              <b className="block font-semibold text-cream">{titulo}</b>
              {texto}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid w-full gap-2">
        <a
          href={alta}
          className="inline-flex min-h-[56px] items-center justify-center rounded-sm bg-cream px-6 text-base font-semibold text-ink hover:bg-crumb"
        >
          Quiero mi tarjeta
        </a>
        <a
          href="/lealtad/entrar"
          className="inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-crust-light underline underline-offset-4"
        >
          Ya tengo tarjeta · Entrar
        </a>
      </div>

      {sucursal && (
        <p className="text-xs text-cream/60">
          Escaneaste el código de <b className="font-semibold text-cream">{sucursal.nombre}</b>.
        </p>
      )}
    </section>
  );
}
