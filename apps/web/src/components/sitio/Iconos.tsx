import type { CSSProperties } from 'react';

/**
 * Íconos del sitio de club-lealtad (24 × 24, trazo redondo). Dibujados aquí,
 * sin librería, para que no viaje al navegador nada que no se use.
 */
const TRAZOS = {
  celular:
    'M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5zM10.5 18.5h3',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM18 18h2v2h-2zM14 19.5h1.5M19.5 14v2',
  escanear:
    'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  sello: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8.5 12.5l2.4 2.4 4.6-5.2',
  regalo:
    'M3.5 8h17v4h-17zM5.5 12v8.5h13V12M12 8v12.5M12 8c-1.6-2.8-5.5-3.4-5.5-1.3C6.5 8.2 10 8 12 8zm0 0c1.6-2.8 5.5-3.4 5.5-1.3 0 1.5-3.5 1.3-5.5 1.3z',
  campana: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4',
  grafica: 'M5 20v-7M11 20V5M17 20v-10M3 20h18',
  personas:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.4 3.3-5.5 6.5-5.5s5.7 2.1 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.8 3 2.6 3.5 5.2',
  tienda: 'M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M9 20v-6h6v6',
  ticket: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  escudo: 'M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6zM9 12l2 2 4-4',
  rayo: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z',
  reloj: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3.2 2',
  corona:
    'M11.6 3.3a.5.5 0 0 1 .8 0l3 5.6a1 1 0 0 0 1.5.3l4.3-3.7a.5.5 0 0 1 .8.5l-2.8 10.3a1 1 0 0 1-1 .7H5.8a1 1 0 0 1-1-.7L2 6a.5.5 0 0 1 .8-.5l4.3 3.7a1 1 0 0 0 1.5-.3zM5 21h14',
  estrella: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  diana:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  fuego:
    'M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.6-2.6-5.9-4.3-8.8-.6 2-1.6 3.1-3 3.8.4-2.7-.5-5.3-2.7-7.3.1 3.5-1.6 5.6-3.1 7.6C4.4 11.6 5.5 13 5.5 14.8 5.5 18.4 8.1 21 12 21z',
  niveles: 'M3 20h5v-5h5v-5h5V5h3',
  medalla:
    'M12 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 11.2L6 2.5h4l2 5 2-5h4l-2.5 8.7M12 13.6l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z',
  tijeras:
    'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.6 7.9L20 17M8.6 16.1L20 7',
  taza: 'M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 10.5h1.5a2.5 2.5 0 0 1 0 5H17M8.5 3.5c-.6.8-.6 1.7 0 2.5M12.5 3.5c-.6.8-.6 1.7 0 2.5',
  pan: 'M3.5 15.5C3.5 10 7.3 6.5 12 6.5s8.5 3.5 8.5 9zM3 15.5h18M8 15.5c0-3 1.8-6 4-7M16 15.5c0-3-1.8-6-4-7M12 8.5v7M4.5 19h15',
  taco: 'M3 17a9 9 0 0 1 18 0zM6 14.5c1.5-.6 2.5.6 4 0s2.5.6 4 0 2.5.6 4 0',
  cubiertos: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 1.3-3.5 3.8-3.5 7.5V14H17',
  copa: 'M6 3h12l-1 5.5a5 5 0 0 1-10 0zM12 13.5V20M8 20.5h8M6.5 7.5h11',
  hoja: 'M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-14 15zM5 19l8-8',
  esmalte: 'M9 3h6v5H9zM8 8h8l1 3v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5V11z',
  paleta:
    'M12 3a9 9 0 0 0 0 18c1.4 0 2-1 1.6-2.1-.5-1.3.4-2.4 1.8-2.4H18a3 3 0 0 0 3-3c0-5.6-4-10.5-9-10.5zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01',
  whatsapp:
    'M4 20l1.3-3.9A8 8 0 1 1 8 19zM9.2 8.6c-.4.9.2 2.6 1.5 3.9s3 1.9 3.9 1.5l.8-1.2-1.8-1-.8.8c-.8-.4-1.5-1.1-1.9-1.9l.8-.8-1-1.8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  flecha: 'M5 12h14M13 6l6 6-6 6',
  cartera:
    'M3.5 7.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 7.5l12-4 1 4M16.5 14h.01',
  control:
    'M7.5 7.5h9a5 5 0 0 1 4.8 6.4l-.9 3a2.3 2.3 0 0 1-3.9.9L14.6 16H9.4l-1.9 1.8a2.3 2.3 0 0 1-3.9-.9l-.9-3a5 5 0 0 1 4.8-6.4zM8 10.5v3M6.5 12h3M15.5 11v.01M17.5 13v.01',
  pregunta:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  ubicacion:
    'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  dinero: 'M3 6.5h18v11H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6.5 9.5v.01M17.5 14.5v.01',
  corazon:
    'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z',
  enlace:
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  basura: 'M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6',
  papel: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  sobre: 'M3.5 6h17v12h-17zM3.5 6.5l8.5 7 8.5-7',
  candado: 'M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
} as const;

export type NombreIconoSitio = keyof typeof TRAZOS;

export function IconoSitio({
  nombre,
  tam = 24,
  grosor = 2,
  className,
  style,
}: {
  nombre: NombreIconoSitio;
  tam?: number;
  grosor?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={tam}
      height={tam}
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}

/** Un ícono dentro de su burbuja de color, como el de las tarjetas del sitio. */
export function Burbuja({
  nombre,
  tono = 'tinte',
  tam = 56,
}: {
  nombre: NombreIconoSitio;
  tono?: 'tinte' | 'pri' | 'pop' | 'blanco';
  tam?: number;
}) {
  return (
    <span className={`ico ${tono}`} style={{ width: tam, height: tam }} aria-hidden="true">
      <IconoSitio nombre={nombre} tam={Math.round(tam * 0.48)} />
    </span>
  );
}

/**
 * El ícono que mejor acompaña un título del sitio, por sus palabras. Así cada
 * tarjeta y cada paso llevan figura sin repetir la lista en cada página; una
 * página puede pasar el suyo cuando quiera otro.
 */
const PISTAS: readonly [RegExp, NombreIconoSitio][] = [
  [/cafeter|caf[eé]\b/i, 'taza'],
  [/panad|pan\b|concha/i, 'pan'],
  [/taquer|taco/i, 'taco'],
  [/barber|corte|peluquer/i, 'tijeras'],
  [/restaur|comida|cocina/i, 'cubiertos'],
  [/\bbar(es)?\b|bebida|cerveza/i, 'copa'],
  [/\bspa|masaje|belleza|salón|salon/i, 'hoja'],
  [/uñas|unas|manicure|gelish/i, 'esmalte'],
  [/escuela|arte|clase/i, 'paleta'],
  [/reto|meta|objetivo/i, 'diana'],
  [/progreso|barra|avance/i, 'grafica'],
  [/reconoc/i, 'medalla'],
  [/racha|constancia|semana/i, 'fuego'],
  [/nivel|bronce|plata|oro/i, 'niveles'],
  [/insignia|medalla/i, 'medalla'],
  [/juego|arcade|gamific|partida/i, 'control'],
  [/mensaje|correo|escrib/i, 'sobre'],
  [/trampa|azar|limpio/i, 'candado'],
  [/premio|regalo|gratis|entrega/i, 'regalo'],
  [/aviso|recuerda|notifica/i, 'campana'],
  [/wallet|guarda/i, 'cartera'],
  [/escane|sella|caja/i, 'escanear'],
  [/\bqr\b|cartel/i, 'qr'],
  [/folio|ticket/i, 'ticket'],
  [/sucursal/i, 'ubicacion'],
  [/marca|logo|color|diseñ/i, 'paleta'],
  [/enlace|dirección|direccion/i, 'enlace'],
  [/acceso|cuenta|equipo|personal/i, 'personas'],
  [/tarjeta|registra|celular|alta/i, 'celular'],
  [/n[uú]mero|reporte|dato|quién|quien/i, 'grafica'],
  [/mentira|seguro|fraude/i, 'escudo'],
  [/descuento|precio|margen|cuesta|pago|plan/i, 'dinero'],
  [/cart[oó]n|papel/i, 'papel'],
  [/r[aá]pid|minuto|segundo/i, 'rayo'],
  [/defin|regla/i, 'papel'],
];

export function iconoPara(...textos: readonly string[]): NombreIconoSitio {
  const texto = textos.join(' ');
  return PISTAS.find(([re]) => re.test(texto))?.[1] ?? 'estrella';
}
