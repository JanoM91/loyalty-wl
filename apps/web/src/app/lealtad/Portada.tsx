import type { ProgramaLealtad } from '@wl/domain';

import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';

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

  const mayor = hitos[hitos.length - 1];
  // Una tarjeta de muestra, a medio camino del primer premio.
  const muestra = Math.max(1, Math.min((primero?.posicion ?? 3) - 1, 3));

  return (
    <section className="grid gap-9 pt-4 pb-6">
      <div className="grid gap-4">
        <h1 className="text-[clamp(2.6rem,13vw,3.5rem)] text-balance">
          {mayor ? `${mayor.nombre} al juntar ${mayor.posicion} visitas` : 'Tus visitas suman'}
        </h1>
        <p className="max-w-[34ch] text-[17px] text-muted">
          {frase ? `${frase}. ` : ''}
          Cada visita es una estampa
          {segundo && primero
            ? `; con ${primero.posicion} ya te llevas ${primero.nombre.toLowerCase().replace(/^tu\s+/, '')}.`
            : '.'}
        </p>
      </div>

      <div aria-hidden="true">
        <TarjetaSellos
          datos={{ estampas: muestra, ciclo: 1, nombre: 'Así se ve' }}
          programa={programa}
          compacta
        />
      </div>

      <ol className="grid gap-5">
        {[
          ['Crea tu tarjeta', 'Con tu celular o tu correo. No instalas nada.'],
          ['Muéstrala en caja', 'Una estampa por visita, en cualquier sucursal.'],
          ['Cobra tu premio', 'Tus estampas y premios no vencen.'],
        ].map(([titulo, texto], i) => (
          <li key={titulo} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-baseline gap-2">
            <span className="font-display text-2xl text-muted tabular-nums">{i + 1}</span>
            <span className="text-[15px] text-muted">
              <b className="block text-[17px] font-semibold text-ink">{titulo}</b>
              {texto}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-3">
        <a
          href={alta}
          className="inline-flex min-h-[60px] items-center justify-center rounded-full bg-ink px-6 text-[17px] font-semibold text-cream"
        >
          Crear mi tarjeta
        </a>
        <a
          href="/lealtad/entrar"
          className="inline-flex min-h-[48px] items-center justify-center rounded-full text-[15px] font-semibold text-ink underline decoration-rule decoration-2 underline-offset-4"
        >
          Ya tengo tarjeta
        </a>
        {sucursal ? (
          <p className="text-center text-[13px] text-muted">Estás en {sucursal.nombre}.</p>
        ) : null}
      </div>
    </section>
  );
}
