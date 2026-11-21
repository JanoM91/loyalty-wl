import { NextResponse, type NextRequest } from 'next/server';
import { esSlugDeNegocio } from '@wl/domain';

/**
 * Dos trabajos en cada petición.
 *
 * **1. De qué negocio es.** Hay tres formas de instalación y las tres acaban
 * igual: una cabecera interna con el negocio y otra con su dirección base.
 *
 * - *Compartida (lite), por ruta*: `sitio.mx/cafe/lealtad`. El primer tramo es
 *   el negocio; por dentro se atiende como `/lealtad`. Es la forma principal.
 * - *Privada*: `WL_NEGOCIO_UNICO=cafe`. Todo el dominio es de ese negocio.
 * - *Por subdominio*: `cafe.sitio.mx` (o `cafe.localhost` al desarrollar).
 *
 * Las pantallas enlazan a `/lealtad/...` y `/admin/...` sin el tramo del
 * negocio. En la instalación por ruta, una petición así se redirige a la
 * dirección completa: el negocio sale de la página desde la que se llegó y, si
 * no la hay, del último negocio visitado en ese navegador.
 *
 * Cualquier valor de las cabeceras internas que mande el navegador se
 * descarta. Elegir negocio no da permisos: las sesiones se buscan dentro del
 * negocio elegido y sus cookies solo viajan en su propia ruta.
 *
 * **2. Primera puerta del panel.** Sin cookie de sesión, `/admin` manda a la
 * pantalla de acceso. La comprobación de verdad la hace `exigirSesion()`.
 */

const CABECERA_NEGOCIO = 'x-wl-negocio';
const CABECERA_ORIGEN = 'x-wl-origen';
const CABECERA_BASE = 'x-wl-base';
const CABECERA_RUTA = 'x-ruta-panel';
const COOKIE_PANEL = 'wl_admin';
/** Último negocio visitado: solo sirve para completar direcciones sin negocio. */
const COOKIE_NEGOCIO = 'wl_negocio';

/**
 * El negocio de un subdominio, o null. `raiz` es el dominio de plataforma;
 * al desarrollar también vale `<negocio>.localhost`.
 */
export function slugDelHost(host: string, raiz: string | undefined): string | null {
  const nombre = host.toLowerCase().split(':')[0] ?? '';
  let etiqueta: string | null = null;
  if (nombre.endsWith('.localhost')) {
    etiqueta = nombre.slice(0, -'.localhost'.length);
  } else if (raiz && nombre.endsWith(`.${raiz.toLowerCase()}`)) {
    etiqueta = nombre.slice(0, -(raiz.length + 1));
  }
  return etiqueta && esSlugDeNegocio(etiqueta) ? etiqueta : null;
}

/** Parte una ruta en negocio y resto: `/cafe/lealtad/x` → `cafe` y `/lealtad/x`. */
export function negocioDeLaRuta(ruta: string): { slug: string; resto: string } | null {
  const [, primero = '', ...demas] = ruta.split('/');
  if (!esSlugDeNegocio(primero)) return null;
  return { slug: primero, resto: `/${demas.join('/')}` };
}

/** ¿Es una pantalla de un negocio (tarjeta o panel) escrita sin su negocio? */
function esRutaDeNegocio(ruta: string): boolean {
  return /^\/(lealtad|admin)(\/|$)/.test(ruta);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // `x-forwarded-host` primero: es la dirección que escribió la persona. La
  // pone la plataforma (Vercel la sobrescribe) y también Next cuando, tras una
  // acción de servidor, pide por dentro la página a la que redirige.
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]!
    .trim();
  const protocolo =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    request.nextUrl.protocol.replace(':', '');
  const origen = `${protocolo}://${host}`;

  let slug: string | null = null;
  let base = '';
  let interna = pathname;

  const unico = process.env.WL_NEGOCIO_UNICO?.trim().toLowerCase();
  if (unico && esSlugDeNegocio(unico)) {
    slug = unico;
  } else {
    slug = slugDelHost(host, process.env.WL_DOMINIO_RAIZ);
    if (!slug) {
      const porRuta = negocioDeLaRuta(pathname);
      if (porRuta) {
        slug = porRuta.slug;
        base = `/${porRuta.slug}`;
        interna = porRuta.resto;
      } else if (esRutaDeNegocio(pathname)) {
        // Dirección sin negocio: se completa y se vuelve a pedir.
        const desde = request.headers.get('referer');
        let previo: string | null = null;
        try {
          const u = desde ? new URL(desde) : null;
          if (u && u.host === host) previo = negocioDeLaRuta(u.pathname)?.slug ?? null;
        } catch {
          previo = null;
        }
        const recordado = request.cookies.get(COOKIE_NEGOCIO)?.value ?? '';
        const destino = previo ?? (esSlugDeNegocio(recordado) ? recordado : null);
        if (destino) {
          const respuesta = NextResponse.redirect(
            new URL(`/${destino}${pathname}${search}`, origen),
            307,
          );
          respuesta.headers.set('Cache-Control', 'no-store');
          return respuesta;
        }
      }
    }
  }

  const cabeceras = new Headers(request.headers);
  for (const c of [CABECERA_NEGOCIO, CABECERA_ORIGEN, CABECERA_BASE, CABECERA_RUTA])
    cabeceras.delete(c);
  if (slug) cabeceras.set(CABECERA_NEGOCIO, slug);
  cabeceras.set(CABECERA_BASE, base);
  cabeceras.set(CABECERA_ORIGEN, `${origen}${base}`);

  if (slug && interna.startsWith('/admin')) {
    const publica =
      interna === '/admin/entrar' ||
      interna === '/admin/entrar/recuperar' ||
      // Android pide el manifest de la app sin cookies.
      interna === '/admin/manifest.webmanifest' ||
      interna.startsWith('/admin/contrasena/');
    if (!publica) {
      if (!request.cookies.get(COOKIE_PANEL)?.value) {
        const respuesta = NextResponse.redirect(new URL(`${base}/admin/entrar`, origen));
        // Ni el navegador ni la CDN deben guardar esta redirección.
        respuesta.headers.set('Cache-Control', 'no-store');
        return respuesta;
      }
      // La ruta viaja en una cabecera para que `exigirSesion()` sepa en qué
      // pantalla está y pueda mandar a la caja a las cuentas de sucursal.
      cabeceras.set(CABECERA_RUTA, interna);
    }
  }

  let respuesta: NextResponse;
  if (base) {
    const destino = request.nextUrl.clone();
    destino.pathname = interna;
    respuesta = NextResponse.rewrite(destino, { request: { headers: cabeceras } });
    respuesta.cookies.set(COOKIE_NEGOCIO, slug!, {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: protocolo === 'https',
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    respuesta = NextResponse.next({ request: { headers: cabeceras } });
  }
  return respuesta;
}

export const config = {
  // Todo menos los archivos estáticos de Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
