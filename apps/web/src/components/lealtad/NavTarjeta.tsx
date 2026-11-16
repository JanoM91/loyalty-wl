import { Icono, type NombreIcono } from './Iconos';

type Seccion = { href: string; etiqueta: string; icono: NombreIcono };

const LATERALES_IZQ: readonly Seccion[] = [
  { href: '/lealtad/premios', etiqueta: 'Premios', icono: 'regalo' },
  { href: '/lealtad/historial', etiqueta: 'Historial', icono: 'historial' },
];
const TARJETA: Seccion = { href: '/lealtad/tarjeta', etiqueta: 'Mi tarjeta', icono: 'qr' };
const LATERALES_DER: readonly Seccion[] = [
  { href: '/lealtad/perfil', etiqueta: 'Perfil', icono: 'persona' },
  { href: '/lealtad/terminos', etiqueta: 'Reglas', icono: 'info' },
];

/**
 * Barra inferior de la tarjeta: Premios · Historial · Mi tarjeta · Perfil ·
 * Reglas.
 *
 * Abajo y no arriba: en el celular es donde llega el pulgar, y el cliente la
 * usa de pie frente a la caja con la compra en la otra mano. La tarjeta va al
 * centro y resaltada: es lo que se abre frente a la caja.
 */
export function NavTarjeta({ actual, premiosListos }: { actual: string; premiosListos: number }) {
  const lateral = (s: Seccion) => {
    const activa = actual === s.href;
    return (
      <li key={s.href}>
        <a
          href={s.href}
          aria-current={activa ? 'page' : undefined}
          className={`relative grid min-h-[60px] justify-items-center gap-0.5 px-1 pt-2 pb-2.5 text-[11.5px] ${activa ? 'font-semibold text-ink' : 'text-muted hover:text-ink'}`}
        >
          <Icono
            nombre={s.icono}
            width={22}
            height={22}
            className={activa ? 'text-crust' : undefined}
          />
          {s.etiqueta}
          {s.href === '/lealtad/premios' && premiosListos > 0 && (
            <span
              aria-label={`${premiosListos} listos`}
              className="absolute top-1 left-[calc(50%+6px)] grid h-[17px] min-w-[17px] place-items-center rounded-full bg-crust-dark px-1 text-[10.5px] font-bold text-cream"
            >
              {premiosListos}
            </span>
          )}
        </a>
      </li>
    );
  };

  const tarjetaActiva = actual === TARJETA.href;

  return (
    <nav
      aria-label="Secciones de tu tarjeta"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-cream/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-start px-1">
        {LATERALES_IZQ.map(lateral)}
        <li>
          <a
            href={TARJETA.href}
            aria-current={tarjetaActiva ? 'page' : undefined}
            className="-mt-[22px] grid justify-items-center gap-1 pb-2.5 text-[11.5px] font-semibold text-ink"
          >
            <span
              className={`grid h-[60px] w-[60px] place-items-center rounded-full border-[3px] bg-ink text-crust-light shadow-[0_10px_22px_-10px_rgba(20,16,12,0.65)] ${tarjetaActiva ? 'border-crust-light' : 'border-ink'}`}
            >
              <Icono nombre={TARJETA.icono} width={26} height={26} />
            </span>
            {TARJETA.etiqueta}
          </a>
        </li>
        {LATERALES_DER.map(lateral)}
      </ul>
    </nav>
  );
}
