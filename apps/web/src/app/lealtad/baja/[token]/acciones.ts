'use server';

import { redirect } from 'next/navigation';
import { darDeBajaPromociones, volverAPromociones } from '@wl/database';

import { tarjetaDeLaBaja } from '@/lib/mensajes';
import { exigirNegocio, ruta } from '@/lib/negocio';

/** Apaga las promociones de la tarjeta del enlace. */
export async function darmeDeBaja(form: FormData): Promise<void> {
  const token = String(form.get('token') ?? '');
  const negocio = await exigirNegocio();
  const cardId = await tarjetaDeLaBaja(negocio.id, token);
  if (cardId) await darDeBajaPromociones(cardId);
  redirect(await ruta(`/lealtad/baja/${token}?listo=baja`));
}

/** «Fue un error»: vuelve a recibir promociones. */
export async function volverARecibir(form: FormData): Promise<void> {
  const token = String(form.get('token') ?? '');
  const negocio = await exigirNegocio();
  const cardId = await tarjetaDeLaBaja(negocio.id, token);
  if (cardId) await volverAPromociones(cardId);
  redirect(await ruta(`/lealtad/baja/${token}?listo=alta`));
}
