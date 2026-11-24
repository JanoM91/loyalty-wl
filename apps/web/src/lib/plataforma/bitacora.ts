import { headers } from 'next/headers';
import { anotarPlataforma, type SesionPlataforma } from '@wl/database';

/**
 * Bitácora del panel de plataforma: cada acción que cambia algo se anota con
 * quién, cuándo, desde qué IP y en qué club. Los textos de `ACCIONES` son los
 * que se leen en `/plataforma/bitacora`.
 */

export const ACCIONES: Readonly<Record<string, string>> = {
  'sesion.entrar': 'Entró al panel',
  'sesion.salir': 'Salió del panel',
  'sesion.recuperar': 'Pidió un enlace para recuperar su contraseña',
  'sesion.contrasena': 'Fijó su contraseña con un enlace',
  'cuenta.contrasena': 'Cambió su contraseña',
  'cuenta.cerrar_sesiones': 'Cerró sus otras sesiones',
  'equipo.invitar': 'Invitó a una persona al equipo',
  'equipo.enlace': 'Generó un enlace de contraseña para alguien del equipo',
  'equipo.baja': 'Dio de baja una cuenta del equipo',
  'equipo.alta': 'Reactivó una cuenta del equipo',
  'club.crear': 'Creó un club',
  'club.invitar_duenio': 'Generó el enlace del dueño',
  'club.suspender': 'Suspendió un club',
  'club.reactivar': 'Reactivó un club',
  'club.modalidad': 'Cambió la modalidad',
  'club.prueba': 'Dio 7 días de prueba',
  'club.pago': 'Registró un pago',
  'club.pago_anulado': 'Anuló un pago',
  'club.borrar': 'Borró un club',
  'club.arcade_permisos': 'Cambió los permisos del Arcade',
  'club.arcade_activo': 'Encendió o apagó el Arcade',
  'club.mensajes': 'Cambió «Mensajes a clientes»',
  'plataforma.borrado_automatico': 'Cambió el borrado automático',
  'plataforma.precios': 'Cambió los precios',
  'plataforma.plantilla_arcade': 'Cambió la plantilla del Arcade',
  'plataforma.exportar': 'Descargó la lista de clubes y dueños',
  'aviso.enviar': 'Mandó un aviso a dueños',
  'aviso.programar': 'Programó un aviso a dueños',
  'aviso.programado_salio': 'Salió un aviso programado',
  'aviso.cancelar': 'Canceló un aviso programado',
  'aviso.plantilla_borrar': 'Borró una plantilla de avisos',
};

/** El texto de una acción; si no está en la lista, la clave tal cual. */
export function textoDeAccion(accion: string): string {
  return ACCIONES[accion] ?? accion;
}

/** IP de quien hace la petición (Vercel la pone primero en `x-forwarded-for`). */
export async function ipDeLaPeticion(): Promise<string | null> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip');
  return ip || null;
}

/** Anota una acción de quien tiene la sesión. Nunca hace fallar la acción. */
export async function anotar(
  sesion: Pick<SesionPlataforma, 'email'>,
  accion: keyof typeof ACCIONES | string,
  extra: {
    readonly club?: { readonly id: string; readonly slug: string } | null;
    readonly detalle?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await anotarPlataforma({
    actor: sesion.email,
    accion,
    club: extra.club ?? null,
    detalle: extra.detalle ?? null,
    ip: await ipDeLaPeticion(),
  });
}
