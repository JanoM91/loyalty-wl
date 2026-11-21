import { arcadeVisible } from '@/lib/lealtad/arcade';

import { Icono, type NombreIcono } from './Iconos';

type Seccion = { href: string; etiqueta: string; icono: NombreIcono };

const LATERALES_IZQ: readonly Seccion[] = [
  { href: '/lealtad/premios', etiqueta: 'Premios', icono: 'regalo' },
  { href: '/lealtad/historial', etiqueta: 'Historial', icono: 'historial' },
];
const TARJETA: Seccion = { href: '/lealtad/tarjeta', etiqueta: 'Mi tarjeta', icono: 'qr' };
const JUEGOS: Seccion = { href: '/lealtad/juegos', etiqueta: 'Juega y gana', icono: 'control' };
const LATERALES_DER: readonly Seccion[] = [
  { href: '/lealtad/perfil', etiqueta: 'Perfil', icono: 'persona' },
  { href: '/lealtad/terminos', etiqueta: 'Reglas', icono: 'info' },
];

/**
 * Barra flotante de la tarjeta: Mi tarjeta, Premios, Historial, Perfil y
 * Reglas, más Juega y gana si el club tiene el Arcade. Solo íconos; la
 * sección en la que estás va rellena.
 *
 * Abajo y no arriba: en el celular es donde llega el pulgar, y el cliente la
 * usa de pie frente a la caja con la compra en la otra mano.
 */
export async function NavTarjeta({
  actual,
  premiosListos,
}: {
  actual: string;
  premiosListos: number;
}) {
  const conJuegos = await arcadeVisible();
  const enlace = (s: Seccion) => {
    const activa = actual === s.href;
    return (
      <li key={s.href}>
        <a
          href={s.href}
          aria-current={activa ? 'page' : undefined}
          aria-label={s.etiqueta}
          title={s.etiqueta}
          className={`relative grid h-12 place-items-center rounded-full transition-colors ${activa ? 'bg-ink text-cream' : 'text-muted hover:text-ink'}`}
        >
          <Icono nombre={s.icono} width={22} height={22} />
          {s.href === '/lealtad/premios' && premiosListos > 0 && (
            <span
              aria-label={`${premiosListos} listos`}
              className="absolute top-1 right-[calc(50%-18px)] grid h-[17px] min-w-[17px] place-items-center rounded-full bg-crust px-1 text-[11px] font-bold text-[var(--wl-fondo)]"
            >
              {premiosListos}
            </span>
          )}
        </a>
      </li>
    );
  };

  return (
    <nav
      aria-label="Secciones de tu tarjeta"
      className="fixed inset-x-0 bottom-0 z-30 px-5"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
    >
      <ul
        className={`mx-auto grid gap-1 rounded-full border border-rule bg-cream/85 p-1.5 shadow-[0_12px_32px_-16px_rgba(0,0,0,0.35)] backdrop-blur-xl ${conJuegos ? 'max-w-[25rem] grid-cols-6' : 'max-w-[22rem] grid-cols-5'}`}
      >
        {(conJuegos
          ? [TARJETA, LATERALES_IZQ[0]!, JUEGOS, ...LATERALES_IZQ.slice(1), ...LATERALES_DER]
          : [TARJETA, ...LATERALES_IZQ, ...LATERALES_DER]
        ).map(enlace)}
      </ul>
    </nav>
  );
}
