'use server';

import { revalidatePath } from 'next/cache';
import {
  actualizarUsuario,
  anularEnlace,
  crearUsuario,
  emitirEnlaceContrasena,
  type Sesion,
  ROLES_USUARIOS,
} from '@wl/database';

import { mandarInvitacion, urlEnlaceContrasena } from '@/lib/admin/correos-usuarios';
import { contextoPeticion, exigirRol } from '@/lib/admin/sesion';
import { fechaLarga, hora } from '@/lib/lealtad/formato';

/**
 * Acciones de la pantalla de usuarios. Solo administración.
 *
 * El permiso se comprueba en cada acción y no solo en la página: una acción de
 * servidor se puede invocar sin pasar por la pantalla que la muestra.
 */
const SOLO_ADMIN = ROLES_USUARIOS;

/** Cómo le llegó (o no) el enlace a la persona. */
export type Entrega =
  | { readonly modo: 'correo'; readonly enviadoA: string }
  | { readonly modo: 'enlace'; readonly enlace: string; readonly vence: string }
  | { readonly modo: 'fallo'; readonly error: string };

/** Lo que se escribió, para no borrar el formulario si algo no pasa la validación. */
export interface ValoresUsuario {
  readonly email: string;
  readonly nombre: string;
  readonly rol: string;
  readonly sucursalId: string;
  readonly activo?: boolean;
  readonly entrega?: 'correo' | 'enlace';
}

function leerValores(form: FormData): ValoresUsuario {
  return {
    email: String(form.get('email') ?? ''),
    nombre: String(form.get('nombre') ?? ''),
    rol: String(form.get('rol') ?? ''),
    sucursalId: String(form.get('sucursal') ?? ''),
    activo: form.get('activo') === 'on',
    entrega: form.get('entrega') === 'enlace' ? 'enlace' : 'correo',
  };
}

/**
 * Emite el enlace y lo entrega por el medio elegido: o por correo, o en
 * pantalla. Nunca los dos (ver `emitirEnlaceContrasena`).
 */
async function entregar(
  userId: string,
  modo: 'correo' | 'enlace',
  sesion: Sesion,
  ip: string | null,
): Promise<Entrega> {
  const porCorreo = modo === 'correo';
  const r = await emitirEnlaceContrasena(userId, { porCorreo }, { userId: sesion.userId, ip });
  if (!r.ok) return { modo: 'fallo', error: r.error };

  if (!porCorreo) {
    return {
      modo: 'enlace',
      enlace: await urlEnlaceContrasena(r.token),
      vence: `${fechaLarga(r.expira)} a las ${hora(r.expira)}`,
    };
  }

  const envio = await mandarInvitacion({
    email: r.email,
    nombre: r.nombre,
    rol: r.rol,
    token: r.token,
    primeraVez: r.primeraVez,
    invitadoPor: sesion.nombre,
  });
  if (!envio.ok) {
    // Nadie recibió ese enlace: se anula para que no quede vivo.
    await anularEnlace(r.token);
    return {
      modo: 'fallo',
      error: envio.configurado
        ? 'el correo no salió. Inténtalo de nuevo o crea un enlace para compartir.'
        : 'el envío de correos no está activo aquí. Crea un enlace para compartir.',
    };
  }
  return { modo: 'correo', enviadoA: r.email };
}

// ---------------------------------------------------------------------------

export interface EstadoAlta {
  readonly error: string | null;
  readonly valores: ValoresUsuario | null;
  readonly creado: {
    readonly id: string;
    readonly nombre: string;
    readonly entrega: Entrega;
  } | null;
}

export async function darDeAlta(_previo: EstadoAlta, form: FormData): Promise<EstadoAlta> {
  const sesion = await exigirRol(SOLO_ADMIN);
  const { ip } = await contextoPeticion();
  const valores = leerValores(form);

  const r = await crearUsuario(
    {
      email: valores.email,
      nombre: valores.nombre,
      rol: valores.rol,
      sucursalId: valores.sucursalId || null,
    },
    { userId: sesion.userId, ip },
  );
  if (!r.ok) return { error: r.error, valores, creado: null };

  const entrega = await entregar(r.id, valores.entrega ?? 'correo', sesion, ip);
  revalidatePath('/admin/usuarios');
  return {
    error: null,
    valores: null,
    creado: { id: r.id, nombre: valores.nombre.trim(), entrega },
  };
}

export interface EstadoGuardar {
  readonly error: string | null;
  readonly aviso: string | null;
  readonly valores: ValoresUsuario | null;
}

export async function guardarUsuario(
  _previo: EstadoGuardar,
  form: FormData,
): Promise<EstadoGuardar> {
  const sesion = await exigirRol(SOLO_ADMIN);
  const { ip } = await contextoPeticion();
  const id = String(form.get('id') ?? '');
  const valores = leerValores(form);

  const r = await actualizarUsuario(
    id,
    {
      email: valores.email,
      nombre: valores.nombre,
      rol: valores.rol,
      sucursalId: valores.sucursalId || null,
      activo: valores.activo ?? false,
    },
    { userId: sesion.userId, ip },
  );
  if (!r.ok) return { error: r.error, aviso: null, valores };

  revalidatePath('/admin/usuarios');
  revalidatePath(`/admin/usuarios/${id}`);
  return {
    error: null,
    valores: null,
    aviso:
      r.cambios === 0
        ? 'No había nada que cambiar.'
        : 'Guardado. Los cambios valen desde la siguiente pantalla que abra esa persona.',
  };
}

export interface EstadoEnlaceAdmin {
  readonly entrega: Entrega | null;
}

export async function generarEnlace(
  _previo: EstadoEnlaceAdmin,
  form: FormData,
): Promise<EstadoEnlaceAdmin> {
  const sesion = await exigirRol(SOLO_ADMIN);
  const { ip } = await contextoPeticion();
  const id = String(form.get('id') ?? '');
  const modo = form.get('modo') === 'enlace' ? 'enlace' : 'correo';

  const entrega = await entregar(id, modo, sesion, ip);
  revalidatePath(`/admin/usuarios/${id}`);
  return { entrega };
}
