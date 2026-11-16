'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@wl/database';

import { exigirRol } from '@/lib/admin/sesion';

export interface EstadoSucursal {
  readonly error: string | null;
  readonly ok: boolean;
}

/**
 * Normaliza un teléfono mexicano a diez dígitos.
 *
 * Acepta cómo lo escribe la gente —"228 818 5964", "(228) 818-5964",
 * "+52 228 818 5964"— porque nadie tiene por qué saber en qué formato lo
 * quiere la base. Devuelve null si no quedan diez dígitos, para no guardar
 * algo que después no sirva para llamar.
 */
function normalizarTelefono(valor: string): string | null | undefined {
  const limpio = valor.trim();
  if (limpio === '') return null;

  let digitos = limpio.replace(/\D/g, '');

  // Prefijo internacional de México, y el viejo 044/045 de los celulares.
  if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2);
  if (digitos.length === 13 && digitos.startsWith('521')) digitos = digitos.slice(3);
  if (digitos.length === 13 && (digitos.startsWith('044') || digitos.startsWith('045'))) {
    digitos = digitos.slice(3);
  }

  return digitos.length === 10 ? digitos : undefined;
}

export async function guardarSucursal(
  _previo: EstadoSucursal,
  form: FormData,
): Promise<EstadoSucursal> {
  await exigirRol(['ADMIN', 'DUENO', 'GERENTE']);

  const slug = String(form.get('slug') ?? '');
  if (!slug) return { ok: false, error: 'Falta la sucursal.' };

  const telefono = normalizarTelefono(String(form.get('telefono') ?? ''));
  if (telefono === undefined) {
    return {
      ok: false,
      error: 'El teléfono debe tener diez dígitos. Puedes escribirlo con espacios.',
    };
  }

  const whatsapp = normalizarTelefono(String(form.get('whatsapp') ?? ''));
  if (whatsapp === undefined) {
    return { ok: false, error: 'El WhatsApp debe tener diez dígitos.' };
  }

  const sucursal = await prisma.branch.findFirst({ where: { slug }, select: { id: true } });
  if (!sucursal) return { ok: false, error: 'No encontramos esa sucursal.' };

  await prisma.branch.update({
    where: { id: sucursal.id },
    data: {
      addressLine: String(form.get('calle') ?? '').trim(),
      neighborhood: String(form.get('colonia') ?? '').trim(),
      postalCode: String(form.get('cp') ?? '').trim(),
      phone: telefono,
      // WhatsApp se guarda en el formato que espera wa.me: 52 delante y sin
      // signos. La conversión se hace aquí para que nadie tenga que saberlo.
      whatsapp: whatsapp ? `52${whatsapp}` : null,
    },
  });

  revalidatePath('/admin/sucursales');

  return { ok: true, error: null };
}
