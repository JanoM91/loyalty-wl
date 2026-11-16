import type { ColoresMarca } from './color';

/**
 * Combinaciones de color listas para elegir en el panel.
 *
 * Los temas parten de la guía «100 combinaciones de colores» de Canva (el
 * número indica cuál). **Los valores son propios**: esa guía publica sus
 * códigos dentro de imágenes, no como texto, así que no se copiaron; cada
 * combinación se armó para los cinco papeles de la tarjeta y pasa la revisión
 * de contraste (`revisarColores`), cosa que una paleta decorativa no garantiza.
 */
export interface CombinacionMarca {
  readonly id: string;
  readonly nombre: string;
  /** Número de la combinación de Canva en la que se inspira. */
  readonly inspiracion: number;
  readonly plantilla: 'aire' | 'noche' | 'calida';
  readonly colores: ColoresMarca;
}

export const COMBINACIONES: readonly CombinacionMarca[] = [
  {
    id: 'coral-menta',
    nombre: 'Coral y menta',
    inspiracion: 1,
    plantilla: 'aire',
    colores: {
      fondo: '#f2684a',
      sobreFondo: '#1f0d08',
      acento: '#0f3d2a',
      papel: '#f4fbf6',
      tinta: '#17251c',
    },
  },
  {
    id: 'azules-frios',
    nombre: 'Azules fríos',
    inspiracion: 5,
    plantilla: 'aire',
    colores: {
      fondo: '#0b4f6c',
      sobreFondo: '#ffffff',
      acento: '#7fd6e8',
      papel: '#f1f7fa',
      tinta: '#0a2a38',
    },
  },
  {
    id: 'dia-y-noche',
    nombre: 'Día y noche',
    inspiracion: 16,
    plantilla: 'noche',
    colores: {
      fondo: '#f7c948',
      sobreFondo: '#14161f',
      acento: '#14161f',
      papel: '#14161f',
      tinta: '#f4f1e6',
    },
  },
  {
    id: 'citricos',
    nombre: 'Cítricos',
    inspiracion: 18,
    plantilla: 'aire',
    colores: {
      fondo: '#f4a300',
      sobreFondo: '#1f1400',
      acento: '#1d5c2e',
      papel: '#fffcf0',
      tinta: '#2b1d00',
    },
  },
  {
    id: 'atardecer',
    nombre: 'Atardecer',
    inspiracion: 19,
    plantilla: 'aire',
    colores: {
      fondo: '#5b2a86',
      sobreFondo: '#ffffff',
      acento: '#ff9e5e',
      papel: '#fbf5fa',
      tinta: '#2a1040',
    },
  },
  {
    id: 'nitido',
    nombre: 'Moderno y nítido',
    inspiracion: 24,
    plantilla: 'aire',
    colores: {
      fondo: '#111111',
      sobreFondo: '#ffffff',
      acento: '#3ddc84',
      papel: '#ffffff',
      tinta: '#111111',
    },
  },
  {
    id: 'nautico',
    nombre: 'Náutico',
    inspiracion: 25,
    plantilla: 'aire',
    colores: {
      fondo: '#14305a',
      sobreFondo: '#ffffff',
      acento: '#e8b54a',
      papel: '#f5f3ec',
      tinta: '#14305a',
    },
  },
  {
    id: 'spa',
    nombre: 'Sereno spa',
    inspiracion: 32,
    plantilla: 'aire',
    colores: {
      fondo: '#d7e8e1',
      sobreFondo: '#17352c',
      acento: '#b3355c',
      papel: '#f6faf8',
      tinta: '#17352c',
    },
  },
  {
    id: 'pasteles',
    nombre: 'Pasteles',
    inspiracion: 35,
    plantilla: 'aire',
    colores: {
      fondo: '#f6d6e0',
      sobreFondo: '#3a1a2a',
      acento: '#5b6fd6',
      papel: '#fdf8fa',
      tinta: '#3a1a2a',
    },
  },
  {
    id: 'neon',
    nombre: 'Noche de neón',
    inspiracion: 40,
    plantilla: 'noche',
    colores: {
      fondo: '#1a1040',
      sobreFondo: '#ffffff',
      acento: '#39ff9c',
      papel: '#0b0720',
      tinta: '#f0ecff',
    },
  },
  {
    id: 'chocolate',
    nombre: 'Chocolate',
    inspiracion: 46,
    plantilla: 'calida',
    colores: {
      fondo: '#4a2c20',
      sobreFondo: '#fdf3e7',
      acento: '#e98a6b',
      papel: '#f8efe4',
      tinta: '#34201a',
    },
  },
  {
    id: 'fresas-crema',
    nombre: 'Fresas y crema',
    inspiracion: 50,
    plantilla: 'aire',
    colores: {
      fondo: '#d7263d',
      sobreFondo: '#ffffff',
      acento: '#ffe9e0',
      papel: '#fff7f3',
      tinta: '#3b0d15',
    },
  },
  {
    id: 'griego',
    nombre: 'Vacaciones griegas',
    inspiracion: 51,
    plantilla: 'aire',
    colores: {
      fondo: '#1565c0',
      sobreFondo: '#ffffff',
      acento: '#ffd166',
      papel: '#f7fafd',
      tinta: '#0d2b52',
    },
  },
  {
    id: 'vinedo',
    nombre: 'Viñedo',
    inspiracion: 53,
    plantilla: 'calida',
    colores: {
      fondo: '#5c1f3a',
      sobreFondo: '#fbf1ea',
      acento: '#c9b27c',
      papel: '#f5efe6',
      tinta: '#3a1526',
    },
  },
  {
    id: 'atemporal',
    nombre: 'Fino y atemporal',
    inspiracion: 62,
    plantilla: 'calida',
    colores: {
      fondo: '#1c2541',
      sobreFondo: '#f7f1e3',
      acento: '#c9a227',
      papel: '#f5f1e8',
      tinta: '#1c2541',
    },
  },
  {
    id: 'vida-nocturna',
    nombre: 'Vida nocturna',
    inspiracion: 65,
    plantilla: 'noche',
    colores: {
      fondo: '#e6007e',
      sobreFondo: '#ffffff',
      acento: '#ffe600',
      papel: '#0d0d0f',
      tinta: '#f2f2f2',
    },
  },
  {
    id: 'mediterraneo',
    nombre: 'Mediterráneo',
    inspiracion: 71,
    plantilla: 'calida',
    colores: {
      fondo: '#8f2d2d',
      sobreFondo: '#fff4e6',
      acento: '#f2c078',
      papel: '#fbf3e6',
      tinta: '#3d1414',
    },
  },
  {
    id: 'cobalto',
    nombre: 'Elegante y moderno',
    inspiracion: 77,
    plantilla: 'aire',
    colores: {
      fondo: '#1f3fff',
      sobreFondo: '#ffffff',
      acento: '#e6e9f0',
      papel: '#f3f4f7',
      tinta: '#111318',
    },
  },
  {
    id: 'metalicos',
    nombre: 'Metálicos',
    inspiracion: 85,
    plantilla: 'noche',
    colores: {
      fondo: '#2b2b2e',
      sobreFondo: '#f4f0e6',
      acento: '#c8a45c',
      papel: '#111112',
      tinta: '#ece8de',
    },
  },
  {
    id: 'cafe-oscuro',
    nombre: 'Oscuro y atractivo',
    inspiracion: 91,
    plantilla: 'calida',
    colores: {
      fondo: '#2e2019',
      sobreFondo: '#f1e9df',
      acento: '#b88a5a',
      papel: '#ece4d8',
      tinta: '#2e2019',
    },
  },
];
