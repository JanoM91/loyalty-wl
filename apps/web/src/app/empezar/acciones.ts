'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import {
  altasRecientes,
  altasRecientesDesde,
  conNegocio,
  contactoConClub,
  crearNegocio,
  definirContrasenaConEnlace,
  direccionLibre,
  guardarLogo,
  iniciarSesion,
  invitarDuenio,
  validarContrasena,
} from '@wl/database';
import {
  COMBINACIONES,
  esPrefijoCodigo,
  giroPorId,
  leerColoresMarca,
  vencimientoDePrueba,
  type ColoresMarca,
} from '@wl/domain';

import { VERSION_LEGAL } from '@/components/sitio/Legal';
import { urlConfirmacionCorreo } from '@/lib/admin/confirmar-correo';
import { contextoPeticion, guardarSesionEnNavegador } from '@/lib/admin/sesion';
import { enviarCorreo } from '@/lib/correo';
import { almacenListo, subirImagenDeMarca } from '@/lib/imagenes-de-marca';
import { mandarBienvenida } from '@/lib/correo-bienvenida';
import { negocioDeLaPeticion, origenDeLaPeticion } from '@/lib/negocio';

export interface EstadoAlta {
  readonly error: string | null;
  /** Paso del asistente donde se corrige el dato rechazado. */
  readonly paso: 1 | 2 | 3 | null;
  /** El correo o el WhatsApp ya tienen club: se ofrece entrar en lugar de crear. */
  readonly yaTieneClub?: boolean;
  /** Club creado: dirección de la pantalla final, que abre el navegador. */
  readonly listo?: string;
}

const fallo = (error: string, paso: 1 | 2 | 3 = 3): EstadoAlta => ({ error, paso });

/** Tope de clubes nuevos por día en todo el sitio: frena altas en ráfaga. */
const TOPE_DIARIO = 40;
/** Tope de clubes nuevos por día desde una misma red (misma IP). */
const TOPE_POR_RED = 3;

/**
 * Huella corta de la IP: sirve para contar altas desde la misma red sin
 * guardar la dirección. Lleva una sal del servidor para que no se pueda
 * revertir probando direcciones.
 */
function huellaDeRed(ip: string | null): string | null {
  const sal = process.env.WL_SAL_RED?.trim() ?? '';
  if (!ip || sal.length < 16) return null;
  return createHash('sha256').update(`${sal}:${ip}`).digest('hex').slice(0, 20);
}

/** "Barbería León" → "barberia-leon". */
function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

/** Celular mexicano a E.164 sin signos: "228 123 4567" → "522281234567". */
function aWhatsApp(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 10) return `52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('52')) return digitos;
  if (digitos.length === 13 && digitos.startsWith('521')) return `52${digitos.slice(3)}`;
  return null;
}

/**
 * Alta de un club desde el asistente público: crea el negocio en prueba, su
 * programa, su sucursal y la cuenta del dueño con la contraseña que eligió,
 * abre su sesión y lo lleva a la pantalla final, desde donde entra al panel.
 */
export async function crearClub(_previo: EstadoAlta, form: FormData): Promise<EstadoAlta> {
  // Solo en el sitio del servicio; nunca dentro de la dirección de un negocio.
  if (process.env.WL_NEGOCIO_UNICO || (await negocioDeLaPeticion())) {
    return fallo('El alta de clubes se hace desde el sitio principal.');
  }
  const t = (k: string) => String(form.get(k) ?? '').trim();

  // Campo trampa: las personas no lo ven; un robot lo llena.
  if (t('sitio_web') !== '') return fallo('No pudimos crear tu club. Inténtalo de nuevo.');

  const nombre = t('nombre').replace(/\s+/g, ' ');
  if (nombre.length < 2 || nombre.length > 80) return fallo('Escribe el nombre de tu negocio.', 1);
  const giro = giroPorId(t('giro'));
  if (!giro) return fallo('Elige el giro de tu negocio.', 1);
  const premio = t('premio').replace(/\s+/g, ' ');
  if (premio.length < 2 || premio.length > 80) return fallo('Escribe el premio de tu tarjeta.', 2);
  const sellos = Number(t('sellos'));
  if (!Number.isInteger(sellos) || sellos < 3 || sellos > 12)
    return fallo('La tarjeta lleva entre 3 y 12 sellos.', 2);
  const duenio = t('duenio').replace(/\s+/g, ' ');
  if (duenio.length < 2 || duenio.length > 80) return fallo('Escribe tu nombre.');
  const whatsapp = aWhatsApp(t('whatsapp'));
  if (!whatsapp) return fallo('Escribe tu WhatsApp con 10 dígitos.');
  const correo = t('correo').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 160)
    return fallo('Escribe un correo válido: con él entras a tu panel.');
  // La contraseña se revisa antes de crear nada: un club a medias no sirve.
  const contrasena = String(form.get('clave') ?? '');
  const revision = validarContrasena(contrasena);
  if (!revision.ok) return fallo(revision.motivo);
  const combinacion =
    COMBINACIONES.find((c) => c.id === t('combinacion')) ??
    COMBINACIONES.find((c) => c.id === giro.combinaciones[0]) ??
    COMBINACIONES[0]!;
  // «Los de tu logo»: colores calculados en el celular a partir del logotipo.
  // Se aceptan solo si se leen bien; si no, va la combinación del giro.
  let coloresDelLogo: ColoresMarca | null = null;
  if (t('combinacion') === 'logo') {
    try {
      coloresDelLogo = leerColoresMarca(JSON.parse(t('colores')));
    } catch {
      coloresDelLogo = null;
    }
  }

  if ((await altasRecientes(24)) >= TOPE_DIARIO) {
    return fallo('Hoy recibimos muchas solicitudes. Escríbenos por WhatsApp y lo armamos.');
  }
  const contexto = await contextoPeticion();
  const red = huellaDeRed(contexto.ip);
  if (red && (await altasRecientesDesde(red, 24)) >= TOPE_POR_RED) {
    return fallo(
      'Ya se crearon varios clubes desde esta conexión hoy. Escríbenos por WhatsApp y lo armamos.',
    );
  }
  if (await contactoConClub(correo, whatsapp)) {
    return {
      error:
        'Ya tienes un club con ese correo o ese WhatsApp. Entra con el correo con el que lo creaste.',
      paso: 3,
      yaTieneClub: true,
    };
  }

  const slug = await direccionLibre(aSlug(nombre) || 'club');
  if (!slug) return fallo('No encontramos una dirección libre con ese nombre. Prueba otro.', 1);
  const letras = slug.replace(/[^a-z0-9]/g, '').toUpperCase();
  const prefijo = esPrefijoCodigo(letras.slice(0, 3)) ? letras.slice(0, 3) : 'CL';
  const clave = aSlug(premio).replace(/-/g, '_').toUpperCase().slice(0, 40) || 'PREMIO';

  const origen = t('origen').slice(0, 20);
  const pruebaVence = vencimientoDePrueba();
  const r = await crearNegocio({
    slug,
    nombre,
    prefijoCodigo: prefijo,
    marca: {
      plantilla: combinacion.plantilla,
      colores: coloresDelLogo ?? combinacion.colores,
      contacto: { correo, whatsapp, sitio: null },
      // El correo del alta también atiende aclaraciones y datos personales.
      legal: { razonSocial: null, domicilio: null, correoPrivacidad: correo },
    },
    ajustes: {
      plan: 'LITE',
      pruebaVence,
      alta: {
        giro: giro.id,
        correo,
        whatsapp,
        origen,
        legal: VERSION_LEGAL,
        ...(red ? { red } : {}),
      },
    },
    programa: {
      posiciones: sellos,
      modalidad: 'VISITA',
      hitos: [{ posicion: sellos, premio: `${clave}_${sellos}`, nombre: premio, incluye: '' }],
      tramos: [],
      ventanaContingenciaDias: 2,
    },
    // El WhatsApp del alta queda también en la sucursal: el cliente lo ve en
    // su tarjeta y la sucursal no nace con el aviso de «sin contacto».
    sucursales: [{ slug: 'principal', nombre: 'Principal', participa: true, whatsapp }],
  });
  if (!r.ok) return fallo(r.error);

  // La contraseña se fija con el mismo enlace de un solo uso que usa la
  // invitación, sin mostrarlo: así queda en la bitácora igual que siempre.
  const invitacion = await invitarDuenio(r.negocio, { email: correo, nombre: duenio });
  if (!invitacion.ok) return fallo(invitacion.error);
  const acceso = await conNegocio(r.negocio, async () => {
    const fijada = await definirContrasenaConEnlace(invitacion.token, contrasena);
    if (!fijada.ok) return null;
    const a = await iniciarSesion(correo, contrasena, contexto);
    return a.ok ? a : null;
  });
  // La sesión vive solo en la dirección del club, como la del acceso normal.
  if (acceso) await guardarSesionEnNavegador(acceso.token, acceso.expira, `/${slug}`);

  // El logotipo que eligió en el asistente se queda como el del club (y de él
  // sale el Sello). Solo se cambia desde el panel. Si algo falla, el club se
  // crea igual y la pantalla final le pide subirlo desde el panel.
  const logo = form.get('logo');
  const sello = form.get('sello');
  let logoGuardado = true;
  if (logo instanceof File && logo.size > 0) {
    logoGuardado = false;
    if (acceso && almacenListo()) {
      try {
        const actor = { userId: acceso.sesion.userId };
        await conNegocio(r.negocio, async () => {
          const url = await subirImagenDeMarca(r.negocio.id, logo, 'logoUrl');
          const guardado = await guardarLogo('logoUrl', url, actor);
          if (!guardado.ok) throw new Error(guardado.error);
          if (sello instanceof File && sello.size > 0) {
            const s = await subirImagenDeMarca(r.negocio.id, sello, 'sello-auto');
            await guardarLogo('iconoUrl', s, actor);
          }
        });
        logoGuardado = true;
      } catch (e) {
        console.warn('[alta] no se pudo guardar el logotipo', e);
      }
    }
  }

  // Aviso a Exkalibur. Si el correo no está configurado, queda en el registro
  // del servidor y el club aparece en /plataforma de todos modos.
  console.warn(`[alta] club nuevo: ${slug} (${giro.id}, ${origen || 'sin origen'})`);
  const avisos = process.env.WL_AVISOS_CORREO?.trim();
  if (avisos) {
    const texto = `Club nuevo en prueba: ${nombre} (${giro.nombre}).\nDueño: ${duenio}\nDirección: /${slug}\nWhatsApp: +${whatsapp}\nCorreo: ${correo}\nOrigen: ${origen || 'sin dato'}`;
    try {
      await enviarCorreo({
        para: avisos,
        asunto: `Club nuevo: ${nombre}`,
        texto,
        html: `<pre>${texto.replace(/[<>&]/g, '')}</pre>`,
      });
    } catch {
      // El aviso no debe impedir el alta.
    }
  }

  // Bienvenida al dueño, con el enlace para confirmar su correo. Sin Resend
  // no sale; el alta no depende de esto.
  try {
    const direccion = `${await origenDeLaPeticion()}/${slug}`;
    await mandarBienvenida({
      para: correo,
      club: nombre,
      direccion,
      pruebaVence,
      confirmar: urlConfirmacionCorreo(direccion, r.negocio.id, invitacion.usuarioId, correo),
    });
  } catch (e) {
    console.warn('[alta] no se pudo mandar la bienvenida', e);
  }

  revalidatePath('/plataforma');
  revalidatePath('/negocios');
  // Si la sesión no se pudo abrir, la pantalla final ofrece entrar con la
  // contraseña recién elegida.
  //
  // La dirección se devuelve y la abre el navegador en cuanto llega (ver
  // `crearYAbrir` en el Asistente). Con `redirect()` aquí, a veces el
  // navegador no terminaba de aplicar la respuesta: el club ya existía, pero
  // el dueño se quedaba en «Creando tu club…».
  return {
    error: null,
    paso: null,
    listo: `/empezar/listo?n=${slug}${acceso ? '' : '&sin-sesion=1'}${logoGuardado ? '' : '&logo=0'}`,
  };
}
