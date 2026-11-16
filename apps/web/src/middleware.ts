import { NextResponse, type NextRequest } from 'next/server';

/**
 * Dos trabajos en cada petición:
 *
 * 1. **De qué negocio es.** Saca el subdominio del `Host` y lo deja en una
 *    cabecera interna. `cafe.<dominio raíz>` → `cafe`. Cualquier valor de esa
 *    cabecera que mande el navegador se descarta: el negocio lo decide la
 *    dirección, no quien pide.
 * 2. **Primera puerta del panel.** Sin cookie de sesión, `/admin` manda a la
 *    pantalla de acceso. No valida la cookie (aquí no hay base de datos): la
 *    comprobación de verdad la hace `exigirSesion()` en cada página.
 */

const CABECERA_NEGOCIO = 'x-wl-negocio';
const CABECERA_ORIGEN = 'x-wl-origen';
const CABECERA_RUTA = 'x-ruta-panel';
const COOKIE_PANEL = 'wl_admin';

const SLUG = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
/** Subdominios que no son negocios. */
const RESERVADOS = new Set(['www', 'app', 'api', 'admin', 'plataforma']);

/**
 * El subdominio del negocio, o null si la dirección es la de la plataforma.
 *
 * `WL_DOMINIO_RAIZ` es el dominio de plataforma ("ejemplo.mx"). En desarrollo
 * también vale `<negocio>.localhost`, que los navegadores resuelven solos.
 */
export function slugDelHost(host: string, raiz: string | undefined): string | null {
  const nombre = host.toLowerCase().split(':')[0] ?? '';
  let etiqueta: string | null = null;
  if (nombre.endsWith('.localhost')) {
    etiqueta = nombre.slice(0, -'.localhost'.length);
  } else if (raiz && nombre.endsWith(`.${raiz.toLowerCase()}`)) {
    etiqueta = nombre.slice(0, -(raiz.length + 1));
  }
  if (!etiqueta || !SLUG.test(etiqueta) || RESERVADOS.has(etiqueta)) return null;
  return etiqueta;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // `x-forwarded-host` primero: es la dirección que escribió la persona. La
  // pone la plataforma (Vercel la sobrescribe) y también Next cuando, tras una
  // acción de servidor, pide por dentro la página a la que redirige; en ese
  // caso `host` es el del propio servidor. Elegir negocio no da ningún
  // permiso: las sesiones se buscan dentro del negocio elegido.
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]!
    .trim();
  const slug = slugDelHost(host, process.env.WL_DOMINIO_RAIZ);

  const cabeceras = new Headers(request.headers);
  cabeceras.delete(CABECERA_NEGOCIO);
  cabeceras.delete(CABECERA_ORIGEN);
  cabeceras.delete(CABECERA_RUTA);
  if (slug) cabeceras.set(CABECERA_NEGOCIO, slug);
  const protocolo =
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  cabeceras.set(CABECERA_ORIGEN, `${protocolo}://${host}`);

  if (pathname.startsWith('/admin')) {
    const publica =
      pathname === '/admin/entrar' ||
      pathname === '/admin/entrar/recuperar' ||
      pathname.startsWith('/admin/contrasena/');
    if (!publica) {
      if (!request.cookies.get(COOKIE_PANEL)?.value) {
        const destino = request.nextUrl.clone();
        destino.pathname = '/admin/entrar';
        destino.search = '';
        const respuesta = NextResponse.redirect(destino);
        // Ni el navegador ni la CDN deben guardar esta redirección.
        respuesta.headers.set('Cache-Control', 'no-store');
        return respuesta;
      }
      // La ruta viaja en una cabecera para que `exigirSesion()` sepa en qué
      // pantalla está y pueda mandar a la caja a las cuentas de sucursal.
      cabeceras.set(CABECERA_RUTA, pathname);
    }
  }

  return NextResponse.next({ request: { headers: cabeceras } });
}

export const config = {
  // Todo menos los archivos estáticos de Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
