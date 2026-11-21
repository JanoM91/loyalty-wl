import type { ProgramaLealtad } from '@wl/domain';
import type { SVGProps } from 'react';

/**
 * Íconos de trazo del programa de lealtad (24×24, línea de 1.75).
 *
 * Dibujados aquí en vez de traer una librería: son pocos, y así no viaja al
 * navegador nada que no se use.
 */

const TRAZOS = {
  tarjeta: 'M3 5h18v14H3zM3 9.5h18M7 15h4',
  regalo:
    'M3.5 8h17v4h-17zM5.5 12v8h13v-8M12 8v12M12 8c-1.6-2.8-5.5-3.4-5.5-1.3C6.5 8.2 10 8 12 8zm0 0c1.6-2.8 5.5-3.4 5.5-1.3 0 1.5-3.5 1.3-5.5 1.3z',
  historial: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5M3.5 3.5v5h5M12 7.5V12l3 2',
  persona: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20.5c1.4-3.8 4.2-5.7 7.5-5.7s6.1 1.9 7.5 5.7',
  qr: 'M3.5 3.5h6.5V10H3.5zM14 3.5h6.5V10H14zM3.5 14H10v6.5H3.5zM14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 19.5h1M19.5 14v1.5',
  croissant:
    'M4.6 13.11l5.79-3.21c1.89-1.05 4.79 1.78 3.71 3.71l-3.22 5.81C8.8 23.16.79 15.23 4.6 13.11zM10.5 9.5l-1-2.29C9.2 6.48 8.8 6 8 6H4.5C2.79 6 2 6.5 2 8.5a7.71 7.71 0 0 0 2 4.83M8 6c0-1.55.24-4-2-4-2 0-2.5 2.17-2.5 4M14.5 13.5l2.29 1c.73.3 1.21.7 1.21 1.5v3.5c0 1.71-.5 2.5-2.5 2.5a7.71 7.71 0 0 1-4.83-2M18 16c1.55 0 4-.24 4 2 0 2-2.17 2.5-4 2.5',
  corona:
    'M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.83 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3zM5 21h14',
  palomita: 'M5 12.5l4.5 4.5L19 7.5',
  alerta: 'M12 4l9 16H3zM12 10v4.5M12 17.2v.01',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5.5M12 7.8v.01',
  reloj: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3.2 2',
  candado: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  camara:
    'M4 8h3l1.8-2.6h6.4L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 9.9a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z',
  ticket: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  izquierda: 'M15 6l-6 6 6 6',
  derecha: 'M9 6l6 6-6 6',
  correo: 'M3 5h18v14H3zM3.5 7l8.5 6 8.5-6',
  salir: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  tienda: 'M4 9.5L5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5h16M9.5 20v-5.5h5V20',
  cruz: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 9l6 6M15 9l-6 6',
  bolsa: 'M5.5 8.5h13l-1 11.5h-11zM9 8.5V7a3 3 0 0 1 6 0v1.5',
  campana: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 21h4',
  control:
    'M7.5 7.5h9a5 5 0 0 1 4.8 6.4l-.9 3a2.3 2.3 0 0 1-3.9.9L14.6 16H9.4l-1.9 1.8a2.3 2.3 0 0 1-3.9-.9l-.9-3a5 5 0 0 1 4.8-6.4zM8 10.5v3M6.5 12h3M15.5 11v.01M17.5 13v.01',
} as const;

export type NombreIcono = keyof typeof TRAZOS;

/**
 * Ícono de cada premio en la tarjeta: los intermedios llevan un regalo y el
 * último hito del programa —el premio mayor— una corona. Va por posición y no por tipo de premio porque
 * los premios se editan desde el panel y su clave cambia con el nombre.
 */
export function iconoDePremio(posicion: number, programa: ProgramaLealtad): NombreIcono {
  const mayor = Math.max(...programa.hitos.map((h) => h.posicion));
  return posicion >= mayor ? 'corona' : 'regalo';
}

export function Icono({ nombre, ...props }: { nombre: NombreIcono } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={20}
      height={20}
      {...props}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
