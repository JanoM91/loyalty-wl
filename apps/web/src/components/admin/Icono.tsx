/**
 * Íconos de línea del panel. Decorativos: siempre van junto a un texto o
 * dentro de un botón con `aria-label`, así que se ocultan al lector.
 */

const TRAZOS = {
  inicio: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  caja: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  clientes:
    'M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7',
  mas: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  atras: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  regalo:
    'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7M12 7c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7',
  sello: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 8v8M8 12h8',
  pastel:
    'M4 21h16M5 21v-7h14v7M5 17c1.5 0 1.5-1.5 3.5-1.5S10 17 12 17s2-1.5 3.5-1.5S17 17 19 17M12 10v4M12 7c.8 0 1.3-.6 1.3-1.3C13.3 4.6 12 3.5 12 3.5s-1.3 1.1-1.3 2.2c0 .7.5 1.3 1.3 1.3',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  imprimir:
    'M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  chat: 'M4 20l1.3-3.9A8 8 0 1 1 8 19z',
  marca:
    'M12 21a9 9 0 1 1 9-9c0 2.5-2 3-3.5 3H15a2 2 0 0 0-1.5 3.3c.6.8.1 2.7-1.5 2.7M7.5 11.5h.01M10.5 7.5h.01M15.5 8.5h.01',
  numeros: 'M5 20V11M11 20V5M17 20v-7M3 20h18',
  revisar: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 13l2 2 4-4',
  ayuda:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  cuenta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
  salir: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  plan: 'M3 6h18v12H3zM3 10h18M7 15h3',
  reglas: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h3',
  equipo:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M21 20a5 5 0 0 0-4-4.9',
  tienda: 'M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M9 20v-6h6v6',
  ficha: 'M3 5h18v14H3zM9 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M5.5 16a3.5 3.5 0 0 1 7 0M15 9h3M15 13h3',
  cerrar: 'M6 6l12 12M18 6L6 18',
  juegos:
    'M7.5 7.5h9a5 5 0 0 1 4.8 6.4l-.9 3a2.3 2.3 0 0 1-3.9.9L14.6 16H9.4l-1.9 1.8a2.3 2.3 0 0 1-3.9-.9l-.9-3a5 5 0 0 1 4.8-6.4zM8 10.5v3M6.5 12h3M15.5 11v.01M17.5 13v.01',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7.5V12l3 2',
  pausa: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M10 9v6M14 9v6',
  externo: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  nuevo: 'M12 5v14M5 12h14',
  aviso: 'M12 4 3 20h18zM12 10v4.5M12 17.5h.01',
  pulso: 'M3 12h4l2.5-6 5 12 2.5-6h4',
  dinero: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6.5 9.5h.01M17.5 14.5h.01',
  bitacora: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  descargar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  llave:
    'M14.5 13a4.5 4.5 0 1 0-4.24-3L3 17.25V21h3.75v-2.25H9V16.5h2.25l1.5-1.5a4.5 4.5 0 0 0 1.75-2',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({
  nombre,
  tam = 22,
  grosor = 1.8,
  className,
}: {
  nombre: NombreIcono;
  tam?: number;
  grosor?: number;
  className?: string;
}) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
