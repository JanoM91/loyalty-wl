import type { Metadata } from 'next';

import { Aviso } from '@/components/lealtad/Aviso';
import { BotonAppleWallet } from '@/components/lealtad/BotonAppleWallet';
import { BotonGoogleWallet } from '@/components/lealtad/BotonGoogleWallet';
import { CodigoQR } from '@/components/lealtad/CodigoQR';
import { Icono } from '@/components/lealtad/Iconos';
import { InvitacionInstalar } from '@/components/lealtad/InvitacionInstalar';
import { NavTarjeta } from '@/components/lealtad/NavTarjeta';
import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';
import { arcadeVisible } from '@/lib/lealtad/arcade';
import { walletActivo } from '@/lib/wallet/activo';
import { exigirTarjeta } from '@/lib/lealtad/sesion';
import { cuponesArcadeDeTarjeta, programaVigente } from '@wl/database';

export const metadata: Metadata = { title: 'Mi tarjeta' };
export const dynamic = 'force-dynamic';

/**
 * La tarjeta del cliente: estampas, premios y el código para la caja.
 *
 * El código va justo debajo de la tarjeta y no escondido tras un botón: es lo
 * que la persona viene a enseñar, con la fila de la caja detrás.
 */
export default async function TarjetaPage({
  searchParams,
}: {
  searchParams: Promise<{ nueva?: string; verificada?: string; guardar?: string }>;
}) {
  const [t, programa, arcade] = await Promise.all([
    exigirTarjeta(),
    programaVigente(),
    arcadeVisible(),
  ]);
  const { nueva, verificada, guardar } = await searchParams;
  const listos = t.premios.filter((p) => p.disponible);
  const promociones = arcade
    ? (await cuponesArcadeDeTarjeta(t.id)).filter((c) => c.estado === 'DISPONIBLE').length
    : 0;

  return (
    <>
      {nueva && (
        <Aviso tono="ok" titulo="Tu tarjeta está lista">
          Muestra este código en caja en tu próxima compra para sumar tu primer sello de visita.
        </Aviso>
      )}
      {guardar && (
        <Aviso tono="info" titulo="Guárdala en tu celular">
          {walletActivo()
            ? 'Elige una: tu pantalla de inicio o tu Wallet. Las dos se actualizan solas con cada sello.'
            : 'Agrégala a tu pantalla de inicio: se actualiza sola con cada sello.'}{' '}
          <a href="#guardar" className="font-semibold underline">
            Ver cómo
          </a>
        </Aviso>
      )}
      {verificada && (
        <Aviso tono="ok" titulo="Correo verificado">
          Ya puedes canjear tus premios y recuperar tu tarjeta desde cualquier celular.
        </Aviso>
      )}

      {listos.length > 0 && (
        <div className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-lg bg-crust-dark p-3.5 text-cream">
          <span
            className="grid h-11 w-11 place-items-center rounded-full bg-cream/15"
            aria-hidden="true"
          >
            <Icono nombre="regalo" width={24} height={24} />
          </span>
          <p className="text-sm leading-snug">
            <b className="block font-display text-lg leading-tight">
              {listos.length === 1 ? '¡Tienes un premio!' : `¡Tienes ${listos.length} premios!`}
            </b>
            Muestra tu código en caja para recibirlo.
          </p>
        </div>
      )}

      {!t.verificada && (
        <Aviso tono="atencion" titulo="Verifica tu correo o tu celular para canjear">
          Tus sellos ya cuentan.{' '}
          <a
            href={t.correo ? '/lealtad/verificar' : '/lealtad/perfil#correo'}
            className="font-semibold underline"
          >
            {t.correo ? 'Verificar mi correo' : 'Agregar mi correo'}
          </a>
          {t.celular && !t.correo && <> o pide en caja que te manden tu enlace por WhatsApp.</>}
        </Aviso>
      )}

      <TarjetaSellos
        programa={programa}
        datos={{
          estampas: t.estampas,
          ciclo: t.ciclo,
          nombre: t.nombre,
          premios: t.premios.map((p) => ({
            tipo: p.tipo,
            nombre: p.nombre,
            posicion: p.posicion,
            ciclo: p.ciclo,
            disponible: p.disponible,
          })),
        }}
      />

      <section
        id="guardar"
        className="grid scroll-mt-4 justify-items-center gap-2 rounded-xl border border-rule bg-cream p-4 text-center"
      >
        <h2 className="font-sans text-[11px] font-semibold text-muted">Muéstralo en caja</h2>
        <CodigoQR codigo={t.codigo} />
        <p className="max-w-[30ch] text-xs text-muted">
          Es el código de tu tarjeta. No contiene tu teléfono ni tu correo.
        </p>
        <BotonAppleWallet />
        <BotonGoogleWallet />
      </section>

      {arcade && (
        <a
          href="/lealtad/juegos"
          className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-rule bg-cream p-3.5 text-ink"
        >
          <span
            className="grid h-11 w-11 place-items-center rounded-full bg-accent/20"
            aria-hidden="true"
          >
            <Icono nombre="control" width={24} height={24} />
          </span>
          <span className="text-sm leading-snug text-ink-soft">
            <b className="block font-display text-lg leading-tight text-ink">Juega y gana</b>
            {promociones > 0
              ? `Tienes ${promociones} ${promociones === 1 ? 'promoción lista' : 'promociones listas'} para caja.`
              : 'Completa retos y desbloquea promociones.'}
          </span>
          <Icono nombre="derecha" aria-hidden="true" />
        </a>
      )}

      <InvitacionInstalar forzar={Boolean(guardar)} />

      <p className="text-xs text-muted">
        Sellos y premios sin vencimiento. Si el negocio define una vigencia, la verás aquí con
        anticipación.
      </p>

      <NavTarjeta actual="/lealtad/tarjeta" premiosListos={listos.length} />
    </>
  );
}
