/**
 * La dirección de un negocio: `<sitio>/<slug>` en la instalación compartida.
 */

/** Forma de un slug: minúsculas, números y guiones; sin guion al inicio ni al final. */
export const FORMA_SLUG = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Nombres que no pueden ser un negocio porque ya son una ruta del sitio (o
 * podrían serlo) o un subdominio de servicio.
 */
export const SLUGS_RESERVADOS: ReadonlySet<string> = new Set([
  'lealtad',
  'admin',
  'api',
  'plataforma',
  'privada',
  'lite',
  'precios',
  'contacto',
  'ayuda',
  'legal',
  'terminos',
  'privacidad',
  'entrar',
  'negocios',
  'como-funciona',
  'gamificacion',
  'planes',
  'guia',
  'empezar',
  'belleza',
  'cafeterias',
  'nuevo',
  'www',
  'app',
  'static',
  'mail',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

/** ¿Sirve como slug de un negocio? */
export function esSlugDeNegocio(valor: string): boolean {
  return FORMA_SLUG.test(valor) && !SLUGS_RESERVADOS.has(valor);
}
