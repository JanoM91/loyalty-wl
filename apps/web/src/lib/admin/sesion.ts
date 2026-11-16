import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NOMBRE_COOKIE, leerSesion, type Sesion, type UserRole } from '@wl/database';
import { rutaBase, ruta } from '@/lib/negocio';

/**
 * Sesión del panel, vista desde la aplicación web.
 *
 * Traduce entre las cookies de Next y las funciones de `@wl/database`.
 * La lógica de seguridad no vive aquí: vive en el paquete de base de datos,
 * para que cualquier otra cosa que en el futuro necesite autenticar use
 * exactamente las mismas reglas.
 */

export type { Sesion };

/** La sesión actual, o null. No redirige: sirve para decidir qué mostrar. */
export async function sesionActual(): Promise<Sesion | null> {
  const galletas = await cookies();
  return leerSesion(galletas.get(NOMBRE_COOKIE)?.value);
}

/**
 * La sesión actual, o fuera.
 *
 * **Se llama en cada página del panel, no solo en el layout.** En Next, un
 * layout no vuelve a ejecutarse en cada navegación dentro de la misma sección,
 * así que confiar solo en él dejaría accesibles pantallas cuya sesión ya
 * caducó. Una consulta más por página es barato comparado con eso.
 */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await sesionActual();
  if (!sesion) redirect(await ruta('/admin/entrar'));
  if (sesion.rol === 'SUCURSAL') await confinarACaja();
  return sesion;
}

/**
 * Rutas que una cuenta de sucursal sí puede abrir: la caja (con sus
 * subpantallas) y su propia cuenta, para cambiar la contraseña.
 */
const RUTAS_SUCURSAL = ['/admin/lealtad/caja', '/admin/cuenta', '/admin/entrar', '/admin/ayuda'];

/**
 * Regla heredada de LAPANA (oct-2026): las cuentas de sucursal solo operan la caja
 * de lealtad. Cualquier otra pantalla del panel las manda a la caja.
 *
 * La ruta la pone el middleware en una cabecera; si no viene (una acción de
 * servidor, por ejemplo), no se redirige: la acción ya comprueba su rol.
 */
async function confinarACaja(): Promise<void> {
  const actual = (await headers()).get('x-ruta-panel');
  if (!actual) return;
  if (RUTAS_SUCURSAL.some((r) => actual === r || actual.startsWith(`${r}/`))) return;
  redirect(await ruta('/admin/lealtad/caja'));
}

/**
 * Exige además un rol suficiente.
 *
 * Los roles no son una jerarquía lineal —MARKETING no es "más" que SUCURSAL,
 * son distintos—, así que se declara explícitamente quién puede entrar a cada
 * sitio en lugar de comparar niveles.
 */
export async function exigirRol(permitidos: readonly UserRole[]): Promise<Sesion> {
  const sesion = await exigirSesion();
  if (!permitidos.includes(sesion.rol)) redirect(await ruta('/admin?sin-permiso=1'));
  return sesion;
}

/** Token de la sesión de este navegador, para cerrar las demás sin cerrar esta. */
export async function tokenDeEsteNavegador(): Promise<string | undefined> {
  const galletas = await cookies();
  return galletas.get(NOMBRE_COOKIE)?.value;
}

/**
 * Guarda en el navegador la sesión que acaba de abrirse. Lo usan la pantalla
 * de acceso y la de definir contraseña, para que las dos pongan la cookie
 * exactamente igual.
 */
export async function guardarSesionEnNavegador(token: string, expira: Date): Promise<void> {
  const galletas = await cookies();
  galletas.set(NOMBRE_COOKIE, token, {
    // httpOnly: el JavaScript de la página no puede leer esta cookie, así que
    // un script inyectado no puede robar la sesión.
    httpOnly: true,
    // secure: solo viaja por HTTPS. En local se permite HTTP porque si no,
    // el panel sería imposible de probar sin certificado.
    secure: process.env.NODE_ENV === 'production',
    // sameSite lax: la cookie no se manda cuando otro sitio provoca una
    // petición a este. Es lo que impide que una página ajena ejecute acciones
    // del panel en nombre de quien tiene sesión abierta.
    sameSite: 'lax',
    // Solo viaja en las direcciones de este negocio: en la instalación
    // compartida, la sesión de un negocio no pisa la de otro.
    path: (await rutaBase()) || '/',
    expires: expira,
  });
}

/** Datos del visitante para el registro de intentos de acceso. */
export async function contextoPeticion(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();

  // Vercel pone la IP real en x-forwarded-for; el primer valor es el cliente y
  // los siguientes son los proxies por los que pasó.
  const reenviada = h.get('x-forwarded-for');
  const ip = reenviada?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;

  return { ip: ip || null, userAgent: h.get('user-agent') };
}
