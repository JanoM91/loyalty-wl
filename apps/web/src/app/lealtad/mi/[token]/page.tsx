import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { tarjetaPorEnlacePersonal } from '@wl/database';

import { Aviso } from '@/components/lealtad/Aviso';
import { AvisoNavegadorIntegrado } from '@/components/lealtad/AvisoNavegadorIntegrado';
import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';
import { BotonMiTarjeta } from './BotonMiTarjeta';

export const metadata: Metadata = { title: 'Mi tarjeta' };
export const dynamic = 'force-dynamic';

/**
 * Enlace personal permanente: <negocio>.<dominio>/lealtad/mi/<token>.
 *
 * Sirve siempre y en cualquier celular. Si este navegador ya tiene abierta
 * esa tarjeta, entra directo; si no, un botón abre la sesión (no se abre al
 * cargar la página: los filtros de correo abren los enlaces para revisarlos).
 *
 * Parámetros opcionales: `a`, enlace de un solo uso de la bienvenida que
 * verifica el correo o el celular.
 */
export default async function MiTarjetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const [{ token }, q] = await Promise.all([params, searchParams]);
  const tarjeta = await tarjetaPorEnlacePersonal(token).catch((err) => {
    console.error('[lealtad] Error consultando enlace personal:', err);
    return null;
  });

  if (!tarjeta) {
    return (
      <>
        <h1 className="text-2xl text-ink">Mi tarjeta</h1>
        <Aviso tono="error" titulo="Este enlace ya no sirve">
          Lo cambiaron desde tu perfil o en caja. Pide tu enlace nuevo en caja o{' '}
          <a href="/lealtad/entrar" className="font-semibold underline">
            entra con tu contraseña
          </a>
          .
        </Aviso>
      </>
    );
  }

  // Ya está abierta aquí (sin enlace de un solo uso por canjear): directo.
  if (!q.a && (await tarjetaDeEsteNavegador()) === tarjeta.cardId) {
    redirect('/lealtad/tarjeta');
  }

  const nombre = tarjeta.nombre?.trim().split(' ')[0];
  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl text-ink">{nombre ? `Hola, ${nombre}` : 'Mi tarjeta'}</h1>
        <p className="text-sm text-ink-soft">
          Este es tu enlace personal: sirve siempre, en cualquier celular y sin contraseña. Guárdalo
          o agrega tu tarjeta a Wallet para tenerla a la mano.
        </p>
      </div>
      <AvisoNavegadorIntegrado />
      <BotonMiTarjeta token={token} a={q.a ?? null} />
      <p className="text-xs text-ink-soft">
        Es personal: no lo compartas. Si lo compartiste por error, cámbialo desde tu perfil.
      </p>
    </>
  );
}
