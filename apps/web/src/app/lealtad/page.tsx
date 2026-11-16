import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { programaVigente } from '@wl/database';

import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';

import { Portada } from './Portada';
import { exigirNegocio, ruta } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Programa de lealtad' };
export const dynamic = 'force-dynamic';

export default async function LealtadPage() {
  // Quien ya tiene tarjeta en este navegador va directo a ella: es lo que
  // necesita frente a la caja.
  if (await tarjetaDeEsteNavegador()) redirect(await ruta('/lealtad/tarjeta'));
  return <Portada programa={await programaVigente()} frase={(await exigirNegocio()).marca.frase} />;
}
