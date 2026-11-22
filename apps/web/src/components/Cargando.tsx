import '@fontsource-variable/fredoka';
import './cargando.css';

import { COLORES_CLUB } from './ClubLealtad';

/**
 * Loader con el logotipo en movimiento: la tarjeta negra se sella sola (ver
 * `cargando.css`). Lo usan los `loading.tsx` mientras carga una página y
 * `CargandoAlNavegar` al pasar de una página a otra.
 *
 * - `club`: marca de club-lealtad (sitio, panel del dueño, plataforma).
 * - `negocio`: la misma tarjeta con los colores del negocio y sin la marca de
 *   club-lealtad (tarjeta y página de inicio de cada club).
 */
export function Cargando({
  variante = 'club',
  alto = 'pantalla',
  fijo = false,
}: {
  variante?: 'club' | 'negocio';
  /** `pantalla`: toda la ventana. `area`: dentro de una columna (tarjeta). */
  alto?: 'pantalla' | 'area';
  /** Encima de la página actual, mientras llega la siguiente. */
  fijo?: boolean;
}) {
  const club = variante === 'club';
  const { noche, lima, coral } = COLORES_CLUB;
  const atras = club ? coral : 'var(--wl-acento)';
  const tarjeta = club ? noche : 'var(--wl-fondo)';
  const filo = club ? lima : 'var(--wl-acento)';
  const sello = club ? lima : 'var(--wl-acento)';
  const premio = club ? coral : 'var(--wl-sobre)';
  const clases = ['wl-cargando', variante, alto === 'area' ? 'area' : '', fijo ? 'fijo' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={clases} role="status" aria-live="polite">
      <svg className="wl-carg-logo" viewBox="0 0 100 100" aria-hidden="true">
        <g transform="rotate(10 52 40)">
          <rect
            className="atras"
            x="20"
            y="18"
            width="64"
            height="44"
            rx="10"
            fill={atras}
            opacity={club ? 1 : 0.45}
          />
        </g>
        <g transform="rotate(-7 49 56)">
          <g className="frente">
            <rect
              x="12.9"
              y="30.9"
              width="72.2"
              height="50.2"
              rx="10.2"
              fill={tarjeta}
              stroke={filo}
              strokeWidth="1.8"
            />
            <rect className="sello s1" x="29" y="36" width="17" height="17" rx="4.5" fill={sello} />
            <rect className="sello s2" x="52" y="36" width="17" height="17" rx="4.5" fill={sello} />
            <rect className="sello s3" x="29" y="59" width="17" height="17" rx="4.5" fill={sello} />
            <rect
              className="sello s4"
              x="52"
              y="59"
              width="17"
              height="17"
              rx="4.5"
              fill={premio}
            />
          </g>
        </g>
      </svg>
      {club ? (
        <span className="wl-carg-marca" aria-hidden="true">
          club
          <i />
          lealtad
        </span>
      ) : null}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
