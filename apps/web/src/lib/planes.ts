/**
 * Qué es Privada, en un solo lugar: lo usan la página de planes del sitio y
 * «Mi plan» del panel, para que nunca digan cosas distintas. Privada no tiene
 * precio publicado: se cotiza en la demo.
 */
export const PRIVADA = {
  frase: 'Tu propio dominio, diseño a la medida y acompañamiento.',
  precio: 'Cotización en la demo',
  nota: 'Según tu marca y tus sucursales.',
  incluye: [
    'Tu propio dominio y página de inicio',
    'Diseño a la medida',
    'Instalación solo para ti',
    'Mensajes a tus clientes por correo',
    'Reportes completos y acompañamiento',
  ],
  migracion: 'Pasas a Privada cuando quieras. La migración la planeamos contigo.',
} as const;
