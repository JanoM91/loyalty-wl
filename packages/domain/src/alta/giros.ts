/**
 * Giros que ofrece el asistente de alta, con el programa que propone a cada
 * uno. Son puntos de partida: el dueño cambia sellos y premio antes de crear
 * su club y después desde su panel.
 */

export type GrupoGiro = 'belleza' | 'cafe' | 'otro';

export interface Giro {
  readonly id: string;
  readonly nombre: string;
  readonly grupo: GrupoGiro;
  /** Sellos que pide la tarjeta completa. */
  readonly sellos: number;
  /** Premio por completar la tarjeta. */
  readonly premio: string;
  /** Combinaciones de color que se ofrecen primero, por id (ver `COMBINACIONES`). */
  readonly combinaciones: readonly string[];
}

const BELLEZA = ['vida-nocturna', 'fresas-crema', 'spa', 'atemporal', 'pasteles', 'cobalto'];
const CAFE = ['cafe-oscuro', 'chocolate', 'coral-menta', 'citricos', 'mediterraneo', 'nitido'];

export const GIROS: readonly Giro[] = [
  {
    id: 'barberia',
    nombre: 'Barbería',
    grupo: 'belleza',
    sellos: 5,
    premio: 'Sexto corte gratis',
    combinaciones: BELLEZA,
  },
  {
    id: 'peluqueria',
    nombre: 'Peluquería',
    grupo: 'belleza',
    sellos: 5,
    premio: 'Sexto corte gratis',
    combinaciones: BELLEZA,
  },
  {
    id: 'salon',
    nombre: 'Salón de belleza',
    grupo: 'belleza',
    sellos: 5,
    premio: '50% en tu siguiente servicio',
    combinaciones: BELLEZA,
  },
  {
    id: 'unas',
    nombre: 'Uñas',
    grupo: 'belleza',
    sellos: 5,
    premio: '50% en tu siguiente servicio',
    combinaciones: BELLEZA,
  },
  {
    id: 'cafeteria',
    nombre: 'Cafetería',
    grupo: 'cafe',
    sellos: 5,
    premio: 'Una pieza gratis',
    combinaciones: CAFE,
  },
  {
    id: 'panaderia',
    nombre: 'Panadería',
    grupo: 'cafe',
    sellos: 5,
    premio: 'Una pieza gratis',
    combinaciones: CAFE,
  },
  {
    id: 'reposteria',
    nombre: 'Repostería',
    grupo: 'cafe',
    sellos: 5,
    premio: 'Una pieza gratis',
    combinaciones: CAFE,
  },
  {
    id: 'otro',
    nombre: 'Otro negocio',
    grupo: 'otro',
    sellos: 5,
    premio: 'Un regalo de la casa',
    combinaciones: ['nitido', 'cobalto', 'coral-menta', 'atemporal', 'citricos', 'spa'],
  },
];

export function giroPorId(id: string): Giro | null {
  return GIROS.find((g) => g.id === id) ?? null;
}

/** Los giros de un grupo primero y el resto después, para la lista del asistente. */
export function girosOrdenados(grupo?: GrupoGiro): readonly Giro[] {
  if (!grupo) return GIROS;
  return [...GIROS.filter((g) => g.grupo === grupo), ...GIROS.filter((g) => g.grupo !== grupo)];
}
