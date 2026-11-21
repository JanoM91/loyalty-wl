'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
  guardarColoresMarca,
  guardarLogo,
  guardarMarca as guardar,
  ROLES_USUARIOS,
  TIPOS_LOGO,
  type TipoLogo,
} from '@wl/database';
import { leerColoresMarca, type ColoresMarca } from '@wl/domain';

import { exigirRol } from '@/lib/admin/sesion';
import {
  ImagenRechazada,
  almacenListo,
  selloSeRehace,
  subirImagenDeMarca,
} from '@/lib/imagenes-de-marca';
import { exigirNegocio } from '@/lib/negocio';
import { actualizarTodosLosPases } from '@/lib/wallet/avisar';

export interface EstadoMarca {
  readonly ok: boolean;
  readonly error: string | null;
  readonly avisos: readonly string[];
}

export async function guardarMarca(_previo: EstadoMarca, form: FormData): Promise<EstadoMarca> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const t = (k: string) => String(form.get(k) ?? '');
  const r = await guardar(
    {
      nombre: t('nombre'),
      plantilla: t('plantilla'),
      frase: t('frase'),
      colores: {
        fondo: t('fondo'),
        sobreFondo: t('sobreFondo'),
        acento: t('acento'),
        papel: t('papel'),
        tinta: t('tinta'),
      },
      correo: t('correo'),
      whatsapp: t('whatsapp'),
      sitio: t('sitio'),
      instagram: t('instagram'),
      razonSocial: t('razonSocial'),
      domicilio: t('domicilio'),
      correoPrivacidad: t('correoPrivacidad'),
    },
    { userId: sesion.userId },
  );
  if (!r.ok) return { ok: false, error: r.error, avisos: [] };
  revalidatePath('/', 'layout');
  // Los pases de Wallet llevan la marca: se les pide que tomen la nueva.
  after(() => actualizarTodosLosPases());
  return { ok: true, error: null, avisos: r.avisos };
}

export interface EstadoLogo {
  readonly ok: boolean;
  readonly error: string | null;
}

const NO_SE_GUARDO = 'No pudimos guardar la imagen. Revisa tu conexión e inténtalo otra vez.';

/** Después de cambiar una imagen: todo lo que la muestra se vuelve a pedir. */
function alCambiarMarca() {
  revalidatePath('/', 'layout');
  // Los pases de Wallet llevan la marca: se les pide que tomen la nueva.
  after(() => actualizarTodosLosPases());
}

/**
 * Cambia el logotipo del club. Llega ya reducido desde el navegador, junto con
 * el Sello que se hizo de él; el Sello solo se reemplaza si no hay uno o si
 * también se hizo de un logotipo (uno subido aparte se respeta).
 */
export async function cambiarLogotipo(form: FormData): Promise<EstadoLogo> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  if (!almacenListo())
    return { ok: false, error: 'Falta configurar el almacén de archivos (Vercel Blob).' };
  const logo = form.get('logo');
  const sello = form.get('sello');
  if (!(logo instanceof File) || logo.size === 0) return { ok: false, error: 'Elige una imagen.' };
  const actor = { userId: sesion.userId };
  try {
    const url = await subirImagenDeMarca(negocio.id, logo, 'logoUrl');
    const r = await guardarLogo('logoUrl', url, actor);
    if (!r.ok) return { ok: false, error: r.error };
    if (sello instanceof File && sello.size > 0 && selloSeRehace(negocio.marca.iconoUrl)) {
      const s = await subirImagenDeMarca(negocio.id, sello, 'sello-auto');
      await guardarLogo('iconoUrl', s, actor);
    }
  } catch (e) {
    if (e instanceof ImagenRechazada) return { ok: false, error: e.message };
    console.error('[marca] no se pudo subir el logotipo', e);
    return { ok: false, error: NO_SE_GUARDO };
  }
  alCambiarMarca();
  return { ok: true, error: null };
}

/** Quita el logotipo; si el Sello se había hecho de él, también se va. */
export async function quitarLogotipo(): Promise<EstadoLogo> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  const actor = { userId: sesion.userId };
  const r = await guardarLogo('logoUrl', null, actor);
  if (!r.ok) return { ok: false, error: r.error };
  if (negocio.marca.iconoUrl && selloSeRehace(negocio.marca.iconoUrl))
    await guardarLogo('iconoUrl', null, actor);
  alCambiarMarca();
  return { ok: true, error: null };
}

/** Aplica a la tarjeta los colores calculados del logotipo. */
export async function usarColoresDelLogo(form: FormData): Promise<EstadoLogo> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  let colores: ColoresMarca | null = null;
  try {
    colores = leerColoresMarca(JSON.parse(String(form.get('colores') ?? '')));
  } catch {
    colores = null;
  }
  if (!colores) return { ok: false, error: 'Esos colores no se leen bien en la tarjeta.' };
  const r = await guardarColoresMarca(colores, { userId: sesion.userId });
  if (!r.ok) return { ok: false, error: r.error };
  alCambiarMarca();
  return { ok: true, error: null };
}

/**
 * Sube o quita una imagen de marca puntual: el logotipo para la tarjeta o un
 * Sello propio. También llega ya preparada desde el navegador.
 */
export async function subirLogo(form: FormData): Promise<EstadoLogo> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  const tipo = String(form.get('tipo') ?? '') as TipoLogo;
  if (!TIPOS_LOGO.includes(tipo)) return { ok: false, error: 'Logotipo desconocido.' };
  const actor = { userId: sesion.userId };

  if (form.get('quitar') === '1') {
    const r = await guardarLogo(tipo, null, actor);
    if (!r.ok) return { ok: false, error: r.error };
    alCambiarMarca();
    return { ok: true, error: null };
  }

  if (!almacenListo())
    return { ok: false, error: 'Falta configurar el almacén de archivos (Vercel Blob).' };
  const archivo = form.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0)
    return { ok: false, error: 'Elige una imagen.' };
  try {
    const url = await subirImagenDeMarca(negocio.id, archivo, tipo);
    const r = await guardarLogo(tipo, url, actor);
    if (!r.ok) return { ok: false, error: r.error };
  } catch (e) {
    if (e instanceof ImagenRechazada) return { ok: false, error: e.message };
    console.error('[marca] no se pudo subir la imagen', e);
    return { ok: false, error: NO_SE_GUARDO };
  }
  alCambiarMarca();
  return { ok: true, error: null };
}
