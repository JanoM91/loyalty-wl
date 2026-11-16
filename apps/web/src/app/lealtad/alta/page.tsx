import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';
import { FormularioAlta } from './FormularioAlta';

export const metadata: Metadata = { title: 'Crea tu tarjeta' };
export const dynamic = 'force-dynamic';

export default async function AltaPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursal?: string }>;
}) {
  if (await tarjetaDeEsteNavegador()) redirect('/lealtad/tarjeta');
  const { sucursal } = await searchParams;

  return (
    <>
      <div className="grid gap-1">
        <a href="/lealtad" className="text-sm text-crust-dark underline underline-offset-4">
          ← Volver
        </a>
        <h1 className="text-2xl text-ink">Crea tu tarjeta</h1>
        <p className="text-sm text-ink-soft">
          Toma menos de 30 segundos. No hace falta descargar nada.
        </p>
      </div>
      <FormularioAlta sucursal={sucursal ?? null} />
    </>
  );
}
