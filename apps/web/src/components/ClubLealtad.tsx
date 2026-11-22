/**
 * Marca de club-lealtad («Tarjeta negra»): isotipo y logotipo para el sitio,
 * el panel del dueño y la plataforma. Los archivos y las reglas de uso están
 * en `marca/` (raíz del repo). El logotipo necesita la fuente Fredoka
 * (`@fontsource-variable/fredoka`) cargada en la pantalla que lo use.
 *
 * El ícono de cada club (tarjeta y panel en el celular) lleva la marca del
 * negocio, no esta.
 */

export const COLORES_CLUB = {
  noche: '#120A2A',
  lima: '#C6FF3D',
  coral: '#FF5B3A',
  violeta: '#6C3BFF',
  crema: '#FFF6EA',
} as const;

/**
 * Isotipo, versión reducida para tamaños chicos: tarjeta negra con filo lima,
 * tres sellos y el premio en coral, con otra tarjeta coral detrás. `oscuro`
 * aclara un poco la tarjeta para que se distinga sobre fondos noche.
 */
export function IsotipoClub({
  tam = 36,
  oscuro = false,
  className = 'iso',
}: {
  tam?: number;
  oscuro?: boolean;
  className?: string;
}) {
  const { lima, coral, noche } = COLORES_CLUB;
  return (
    <svg className={className} width={tam} height={tam} viewBox="0 0 100 100" aria-hidden="true">
      <rect
        x="20"
        y="18"
        width="64"
        height="44"
        rx="10"
        fill={coral}
        transform="rotate(10 52 40)"
      />
      <g transform="rotate(-7 49 56)">
        <rect
          x="12.9"
          y="30.9"
          width="72.2"
          height="50.2"
          rx="10.2"
          fill={oscuro ? '#1E1440' : noche}
          stroke={lima}
          strokeWidth="1.8"
        />
        <rect x="29" y="36" width="17" height="17" rx="4.5" fill={lima} />
        <rect x="52" y="36" width="17" height="17" rx="4.5" fill={lima} />
        <rect x="29" y="59" width="17" height="17" rx="4.5" fill={lima} />
        <rect className="pr" x="52" y="59" width="17" height="17" rx="4.5" fill={coral} />
      </g>
    </svg>
  );
}

/**
 * Logotipo completo: isotipo + «club▪lealtad». Con estilos propios para usarse
 * fuera del sitio (panel, plataforma). `sobre` es el fondo donde va.
 */
export function LogotipoClub({
  tam = 20,
  sobre = 'claro',
}: {
  /** Tamaño de la letra, en px. */
  tam?: number;
  sobre?: 'claro' | 'oscuro';
}) {
  const { noche, crema, coral, lima } = COLORES_CLUB;
  return (
    <span
      role="img"
      aria-label="club-lealtad"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(tam * 0.38),
        fontFamily: "'Fredoka Variable', 'Fredoka', ui-sans-serif, system-ui, sans-serif",
        fontWeight: 600,
        fontSize: tam,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        color: sobre === 'claro' ? noche : crema,
        whiteSpace: 'nowrap',
      }}
    >
      <IsotipoClub tam={Math.round(tam * 1.5)} oscuro={sobre === 'oscuro'} />
      <span aria-hidden="true">
        club
        <span
          style={{
            display: 'inline-block',
            width: '.2em',
            height: '.2em',
            borderRadius: '.05em',
            background: sobre === 'claro' ? coral : lima,
            margin: '0 .07em',
            verticalAlign: '.14em',
          }}
        />
        lealtad
      </span>
    </span>
  );
}
