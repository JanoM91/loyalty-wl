'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  altasRecientes,
  contactoConClub,
  crearNegocio,
  direccionLibre,
  invitarDuenio,
} from '@wl/database';
import { COMBINACIONES, esPrefijoCodigo, giroPorId, vencimientoDePrueba } from '@wl/domain';

import { VERSION_LEGAL } from '@/components/sitio/Legal';
import { enviarCorreo } from '@/lib/correo';
import { negocioDeLaPeticion } from '@/lib/negocio';

export interface EstadoAlta {
  readonly error: string | null;
}

/** Tope de clubes nuevos por día en todo el sitio: frena altas en ráfaga. */
const TOPE_DIARIO = 40;

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
 * programa, su sucursal y la cuenta del dueño, y lo lleva a la pantalla final.
 */
export async function crearClub(_previo: EstadoAlta, form: FormData): Promise<EstadoAlta> {
  // Solo en el sitio del servicio; nunca dentro de la dirección de un negocio.
  if (process.env.WL_NEGOCIO_UNICO || (await negocioDeLaPeticion())) {
    return { error: 'El alta de clubes se hace desde el sitio principal.' };
  }
  const t = (k: string) => String(form.get(k) ?? '').trim();

  // Campo trampa: las personas no lo ven; un robot lo llena.
  if (t('sitio_web') !== '') return { error: 'No pudimos crear tu club. Inténtalo de nuevo.' };

  const nombre = t('nombre').replace(/\s+/g, ' ');
  if (nombre.length < 2 || nombre.length > 80) return { error: 'Escribe el nombre de tu negocio.' };
  const giro = giroPorId(t('giro'));
  if (!giro) return { error: 'Elige el giro de tu negocio.' };
  const premio = t('premio').replace(/\s+/g, ' ');
  if (premio.length < 2 || premio.length > 80) return { error: 'Escribe el premio de tu tarjeta.' };
  const sellos = Number(t('sellos'));
  if (!Number.isInteger(sellos) || sellos < 3 || sellos > 12)
    return { error: 'La tarjeta lleva entre 3 y 12 sellos.' };
  const whatsapp = aWhatsApp(t('whatsapp'));
  if (!whatsapp) return { error: 'Escribe tu WhatsApp con 10 dígitos.' };
  const correo = t('correo').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 160)
    return { error: 'Escribe un correo válido: con él entras a tu panel.' };
  const combinacion =
    COMBINACIONES.find((c) => c.id === t('combinacion')) ??
    COMBINACIONES.find((c) => c.id === giro.combinaciones[0]) ??
    COMBINACIONES[0]!;

  if ((await altasRecientes(24)) >= TOPE_DIARIO) {
    return { error: 'Hoy recibimos muchas solicitudes. Escríbenos por WhatsApp y lo armamos.' };
  }
  if (await contactoConClub(correo, whatsapp)) {
    return {
      error: 'Ya hay un club con ese correo o ese WhatsApp. Escríbenos y te ayudamos a entrar.',
    };
  }

  const slug = await direccionLibre(aSlug(nombre) || 'club');
  if (!slug) return { error: 'No encontramos una dirección libre con ese nombre. Prueba otro.' };
  const letras = slug.replace(/[^a-z0-9]/g, '').toUpperCase();
  const prefijo = esPrefijoCodigo(letras.slice(0, 3)) ? letras.slice(0, 3) : 'CL';
  const clave = aSlug(premio).replace(/-/g, '_').toUpperCase().slice(0, 40) || 'PREMIO';

  const origen = t('origen').slice(0, 20);
  const r = await crearNegocio({
    slug,
    nombre,
    prefijoCodigo: prefijo,
    marca: {
      plantilla: combinacion.plantilla,
      colores: combinacion.colores,
      contacto: { correo, whatsapp, sitio: null },
    },
    ajustes: {
      plan: 'LITE',
      pruebaVence: vencimientoDePrueba(),
      alta: { giro: giro.id, correo, whatsapp, origen, legal: VERSION_LEGAL },
    },
    programa: {
      posiciones: sellos,
      modalidad: 'VISITA',
      hitos: [{ posicion: sellos, premio: `${clave}_${sellos}`, nombre: premio, incluye: '' }],
      tramos: [],
      ventanaContingenciaDias: 2,
    },
    sucursales: [{ slug: 'principal', nombre: 'Principal', participa: true }],
  });
  if (!r.ok) return { error: r.error };

  // El asistente no pide el nombre de la persona: la cuenta nace sin él.
  const invitacion = await invitarDuenio(r.negocio, { email: correo, nombre: '' });
  if (!invitacion.ok) return { error: invitacion.error };

  // Aviso a Exkalibur. Si el correo no está configurado, queda en el registro
  // del servidor y el club aparece en /plataforma de todos modos.
  console.warn(`[alta] club nuevo: ${slug} (${giro.id}, ${origen || 'sin origen'})`);
  const avisos = process.env.WL_AVISOS_CORREO?.trim();
  if (avisos) {
    const texto = `Club nuevo en prueba: ${nombre} (${giro.nombre}).\nDirección: /${slug}\nWhatsApp: +${whatsapp}\nCorreo: ${correo}\nOrigen: ${origen || 'sin dato'}`;
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

  revalidatePath('/plataforma');
  revalidatePath('/negocios');
  redirect(`/empezar/listo?n=${slug}&t=${encodeURIComponent(invitacion.token)}`);
}
