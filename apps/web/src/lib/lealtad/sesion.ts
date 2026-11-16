import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  NOMBRE_COOKIE_TARJETA,
  cerrarSesionTarjeta,
  leerSesionTarjeta,
  obtenerTarjeta,
  type VistaTarjeta,
} from '@wl/database';

/**
 * Sesión de la tarjeta de lealtad en el navegador del cliente.
 *
 * Igual que en el panel: esta capa solo traduce entre las cookies de Next y
 * las funciones de `@wl/database`, donde viven las reglas.
 */

/** El id de la tarjeta de este navegador, o null. */
export async function tarjetaDeEsteNavegador(): Promise<string | null> {
  const galletas = await cookies();
  return leerSesionTarjeta(galletas.get(NOMBRE_COOKIE_TARJETA)?.value).catch((err) => {
    console.error('[lealtad] Error leyendo sesión de tarjeta:', err);
    return null;
  });
}

/** La tarjeta completa o, si no hay sesión, de vuelta a la portada del programa. */
export async function exigirTarjeta(): Promise<VistaTarjeta> {
  const id = await tarjetaDeEsteNavegador();
  const tarjeta = id
    ? await obtenerTarjeta(id).catch((err) => {
        console.error('[lealtad] Error consultando balance de tarjeta:', err);
        return null;
      })
    : null;
  if (!tarjeta) redirect('/lealtad');
  return tarjeta;
}

/** Guarda la sesión en una cookie que el JavaScript de la página no puede leer. */
export async function guardarSesionTarjeta(token: string, expira: Date): Promise<void> {
  const galletas = await cookies();
  galletas.set(NOMBRE_COOKIE_TARJETA, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expira,
  });
}

export async function cerrarSesionDeTarjeta(): Promise<void> {
  const galletas = await cookies();
  await cerrarSesionTarjeta(galletas.get(NOMBRE_COOKIE_TARJETA)?.value);
  galletas.delete(NOMBRE_COOKIE_TARJETA);
}
