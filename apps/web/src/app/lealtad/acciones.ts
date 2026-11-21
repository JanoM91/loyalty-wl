'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  NOMBRE_COOKIE_TARJETA,
  abrirConEnlacePersonal,
  actualizarPerfil,
  canjearEnlaceAcceso,
  cambiarCelular,
  cambiarContrasenaTarjeta,
  cambiarCorreo,
  crearContrasenaTarjeta,
  crearTarjeta,
  emitirCodigoVerificacion,
  entrarConContrasena,
  olvideContrasena,
  regenerarEnlacePersonal,
  verificarCodigo,
} from '@wl/database';
import { RESPUESTA_OLVIDE_CONTRASENA, leerDatoDeAcceso } from '@wl/domain';

import { after } from 'next/server';

import { contextoPeticion } from '@/lib/admin/sesion';
import { enviarCorreo, plantillaCorreo } from '@/lib/correo';
import {
  cerrarSesionDeTarjeta,
  guardarSesionTarjeta,
  tarjetaDeEsteNavegador,
} from '@/lib/lealtad/sesion';
import { avisarCambioDeTarjeta } from '@/lib/wallet/avisar';
import { exigirNegocio, origenDeLaPeticion, ruta } from '@/lib/negocio';

/**
 * Acciones del cliente en su tarjeta.
 *
 * Todo se decide en el servidor. Los formularios solo muestran lo que estas
 * funciones devuelven; nada de lo que llega del navegador se da por bueno.
 */

export interface Estado {
  readonly error: string | null;
  readonly aviso?: string | null;
  readonly ok?: boolean;
}

async function agente(): Promise<string | null> {
  return (await headers()).get('user-agent');
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export async function crear(_previo: Estado, form: FormData): Promise<Estado> {
  const resultado = await crearTarjeta({
    contacto: String(form.get('contacto') ?? ''),
    aceptaTerminos: form.get('terminos') === 'on',
    aceptaPromociones: form.get('promociones') === 'on',
    sucursalSlug: String(form.get('sucursal') ?? '') || null,
    userAgent: await agente(),
  });

  if (!resultado.ok) return { error: resultado.error };

  await guardarSesionTarjeta(resultado.token, resultado.expira);
  redirect(await ruta('/lealtad/tarjeta?nueva=1'));
}

// ---------------------------------------------------------------------------
// Verificación del correo
// ---------------------------------------------------------------------------

export async function enviarCodigo(_previo: Estado): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));

  const emision = await emitirCodigoVerificacion(id);
  if (!emision.ok) return { error: emision.error };

  const negocio = await exigirNegocio();
  const envio = await enviarCorreo({
    para: emision.correo,
    asunto: `Tu código de ${negocio.nombre}: ${emision.codigo}`,
    texto: `Tu código para verificar tu tarjeta de lealtad de ${negocio.nombre} es ${emision.codigo}. Vence en 10 minutos y sirve una sola vez.`,
    html: plantillaCorreo('Verifica tu tarjeta', [
      `Tu código es ${emision.codigo}.`,
      'Escríbelo en tu tarjeta para poder canjear tus premios. Vence en 10 minutos y sirve una sola vez.',
      'Si no lo pediste tú, ignora este correo.',
    ]),
  });

  if (!envio.ok) {
    return {
      error: envio.configurado
        ? envio.error
        : 'El envío de correos todavía no está activo. Mientras tanto, tus sellos siguen sumando.',
    };
  }

  return { error: null, ok: true, aviso: `Te enviamos un código a ${emision.correo}.` };
}

export async function confirmarCodigo(_previo: Estado, form: FormData): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));

  const r = await verificarCodigo(id, String(form.get('codigo') ?? ''));
  if (!r.ok) return { error: r.error };

  revalidatePath('/lealtad', 'layout');
  redirect(await ruta('/lealtad/tarjeta?verificada=1'));
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

function entero(valor: FormDataEntryValue | null): number | null {
  const s = String(valor ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
}

export async function guardarPerfil(_previo: Estado, form: FormData): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));

  const r = await actualizarPerfil(id, {
    nombre: String(form.get('nombre') ?? ''),
    cumpleDia: entero(form.get('dia')),
    cumpleMes: entero(form.get('mes')),
    promociones: form.get('promociones') === 'on',
  });
  if (!r.ok) return { error: r.error };

  revalidatePath('/lealtad', 'layout');
  return { error: null, ok: true, aviso: 'Guardado.' };
}

export async function guardarCorreo(_previo: Estado, form: FormData): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));

  const r = await cambiarCorreo(id, String(form.get('correo') ?? ''));
  if (!r.ok) return { error: r.error };

  revalidatePath('/lealtad', 'layout');
  redirect(await ruta('/lealtad/verificar'));
}

export async function guardarCelular(_previo: Estado, form: FormData): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));

  const r = await cambiarCelular(id, String(form.get('celular') ?? ''));
  if (!r.ok) return { error: r.error };

  revalidatePath('/lealtad', 'layout');
  return { error: null, ok: true, aviso: 'Celular guardado.' };
}

// ---------------------------------------------------------------------------
// Contraseña: entrar, olvidé, crear y cambiar
// Ver docs/22-lealtad-acceso-con-contrasena.md.
// ---------------------------------------------------------------------------

export async function entrar(_previo: Estado, form: FormData): Promise<Estado> {
  const { ip, userAgent } = await contextoPeticion();
  const r = await entrarConContrasena(
    String(form.get('dato') ?? ''),
    String(form.get('clave') ?? ''),
    { ip, userAgent },
  );
  if (!r.ok) return { error: r.error };

  await guardarSesionTarjeta(r.token, r.expira);
  redirect(await ruta('/lealtad/tarjeta'));
}

/**
 * «Olvidé mi contraseña». La respuesta en pantalla es la misma exista o no la
 * tarjeta, tenga correo o solo celular, y aunque el correo no salga: decir
 * otra cosa le confirmaría a cualquiera quién tiene tarjeta.
 */
export async function olvide(_previo: Estado, form: FormData): Promise<Estado> {
  const dato = String(form.get('dato') ?? '');
  if (!leerDatoDeAcceso(dato)) return { error: 'Escribe el correo o el celular de tu tarjeta.' };

  const { ip } = await contextoPeticion();
  const r = await olvideContrasena(dato, { ip });

  if (r.tipo === 'CORREO') {
    const url = `${await origenDeLaPeticion()}/lealtad/acceso/${r.token}`;
    const envio = await enviarCorreo({
      para: r.correo,
      asunto: `Crea tu contraseña nueva de ${(await exigirNegocio()).nombre}`,
      texto: `Para entrar a tu tarjeta de lealtad y crear una contraseña nueva, abre ${url} . El enlace vence en 30 minutos y sirve una sola vez. Si no lo pediste tú, ignora este correo.`,
      html: plantillaCorreo(
        'Crea tu contraseña nueva',
        [
          'Toca el botón para abrir tu tarjeta de lealtad y crear una contraseña nueva.',
          'El enlace vence en 30 minutos y sirve una sola vez. Si no lo pediste tú, ignora este correo: tu contraseña actual sigue funcionando.',
        ],
        { texto: 'Crear mi contraseña', url },
      ),
    });
    if (!envio.ok) console.error('No salió el correo de «Olvidé mi contraseña»:', envio.error);
  }

  return { error: null, ok: true, aviso: RESPUESTA_OLVIDE_CONTRASENA };
}

/** Primera contraseña con la sesión abierta (aviso «Crea tu contraseña»). */
export async function crearContrasena(_previo: Estado, form: FormData): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));

  const r = await crearContrasenaTarjeta(id, String(form.get('clave') ?? ''));
  if (!r.ok) return { error: r.error };

  revalidatePath('/lealtad', 'layout');
  return {
    error: null,
    ok: true,
    aviso: 'Listo. Desde ahora entras con tu correo o celular y esta contraseña.',
  };
}

export async function cambiarContrasena(_previo: Estado, form: FormData): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));

  const { ip } = await contextoPeticion();
  const r = await cambiarContrasenaTarjeta(
    id,
    String(form.get('actual') ?? ''),
    String(form.get('clave') ?? ''),
    { ip, tokenSesion: (await cookies()).get(NOMBRE_COOKIE_TARJETA)?.value ?? null },
  );
  if (!r.ok) return { error: r.error };

  revalidatePath('/lealtad', 'layout');
  return {
    error: null,
    ok: true,
    aviso: 'Contraseña cambiada. Cerramos tu tarjeta en los demás celulares.',
  };
}

/** El formulario del perfil: crea o cambia según lo que tenga la tarjeta. */
export async function guardarContrasena(previo: Estado, form: FormData): Promise<Estado> {
  return form.get('modo') === 'cambiar'
    ? cambiarContrasena(previo, form)
    : crearContrasena(previo, form);
}

// ---------------------------------------------------------------------------
// Enlace de acceso y cerrar sesión
// ---------------------------------------------------------------------------

export interface EstadoEnlace extends Estado {
  /** El enlace sigue vigente: solo hay que corregir la contraseña. */
  readonly contrasena?: boolean;
}

export async function entrarConEnlace(
  _previo: EstadoEnlace,
  form: FormData,
): Promise<EstadoEnlace> {
  const clave = String(form.get('clave') ?? '');
  const r = await canjearEnlaceAcceso(String(form.get('token') ?? ''), await agente(), {
    clave: clave || null,
  });
  if (!r.ok) return { error: r.error, contrasena: r.contrasena };

  await guardarSesionTarjeta(r.token, r.expira);
  redirect(await ruta('/lealtad/tarjeta'));
}

// ---------------------------------------------------------------------------
// Enlace personal permanente («Mi tarjeta»)
// ---------------------------------------------------------------------------

export async function abrirMiTarjeta(_previo: Estado, form: FormData): Promise<Estado> {
  const r = await abrirConEnlacePersonal(String(form.get('token') ?? ''), {
    userAgent: await agente(),
    enlaceUnUso: String(form.get('a') ?? '') || null,
    mensajeCampanaId: String(form.get('c') ?? '') || null,
  });
  if (!r.ok) return { error: 'Este enlace ya no sirve. Pide uno nuevo en caja.' };
  await guardarSesionTarjeta(r.token, r.expira);
  redirect(await ruta('/lealtad/tarjeta'));
}

/** Desde el perfil: el enlace anterior deja de servir y los pases llevan el nuevo. */
export async function cambiarEnlacePersonal(_previo: Estado): Promise<Estado> {
  const id = await tarjetaDeEsteNavegador();
  if (!id) redirect(await ruta('/lealtad'));
  const { ip } = await contextoPeticion();
  const token = await regenerarEnlacePersonal(id, { ip });
  if (!token) return { error: 'No se pudo cambiar el enlace. Inténtalo de nuevo.' };
  after(() => avisarCambioDeTarjeta(id));
  revalidatePath('/lealtad/perfil');
  return { error: null, ok: true, aviso: 'Listo: tu enlace anterior ya no sirve.' };
}

export async function salir(): Promise<void> {
  await cerrarSesionDeTarjeta();
  redirect(await ruta('/lealtad'));
}
