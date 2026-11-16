'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { put } from '@vercel/blob';
import {
  guardarLogo,
  guardarMarca as guardar,
  ROLES_USUARIOS,
  TIPOS_LOGO,
  type TipoLogo,
} from '@wl/database';

import { exigirRol } from '@/lib/admin/sesion';
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

const FORMATOS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAXIMO_LOGO = 1_000_000;

/** Sube un logotipo al almacén, en la carpeta de marca de este negocio, y lo guarda. */
export async function subirLogo(_previo: EstadoLogo, form: FormData): Promise<EstadoLogo> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  const tipo = String(form.get('tipo') ?? '') as TipoLogo;
  if (!TIPOS_LOGO.includes(tipo)) return { ok: false, error: 'Logotipo desconocido.' };

  if (form.get('quitar') === '1') {
    const r = await guardarLogo(tipo, null, { userId: sesion.userId });
    if (!r.ok) return { ok: false, error: r.error };
    revalidatePath('/', 'layout');
    // Los pases de Wallet llevan la marca: se les pide que tomen la nueva.
    after(() => actualizarTodosLosPases());
    return { ok: true, error: null };
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return { ok: false, error: 'Falta configurar el almacén de archivos (Vercel Blob).' };
  const archivo = form.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0)
    return { ok: false, error: 'Elige un archivo.' };
  const extension = FORMATOS[archivo.type];
  if (!extension) return { ok: false, error: 'El logotipo debe ser PNG, JPG o WebP.' };
  if (archivo.size > MAXIMO_LOGO) return { ok: false, error: 'El archivo pesa más de 1 MB.' };

  const subida = await put(`negocios/${negocio.id}/marca/${tipo}.${extension}`, archivo, {
    access: 'public',
    addRandomSuffix: true,
    contentType: archivo.type,
  });
  const r = await guardarLogo(tipo, subida.url, { userId: sesion.userId });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath('/', 'layout');
  // Los pases de Wallet llevan la marca: se les pide que tomen la nueva.
  after(() => actualizarTodosLosPases());
  return { ok: true, error: null };
}
