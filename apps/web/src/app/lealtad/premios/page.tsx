import type { Metadata } from 'next';
import { programaVigente } from '@wl/database';
import { textoProximoPremio } from '@wl/domain';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono, iconoDePremio } from '@/components/lealtad/Iconos';
import { NavTarjeta } from '@/components/lealtad/NavTarjeta';
import { exigirTarjeta } from '@/lib/lealtad/sesion';
import { fechaLarga } from '@/lib/lealtad/formato';

export const metadata: Metadata = { title: 'Mis premios' };
export const dynamic = 'force-dynamic';

export default async function PremiosPage() {
  const t = await exigirTarjeta();
  const programa = await programaVigente();
  const disponibles = t.premios.filter((p) => p.disponible);
  const entregados = t.premios.filter((p) => !p.disponible);

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl text-ink">Mis premios</h1>
        <p className="text-sm text-ink-soft">
          {disponibles.length > 0
            ? `${disponibles.length} ${disponibles.length === 1 ? 'listo' : 'listos'} para canjear en caja.`
            : textoProximoPremio(t.estampas, programa)}
        </p>
      </div>

      {!t.verificada && disponibles.length > 0 && (
        <Aviso tono="atencion" titulo="Para canjear necesitas verificar tu correo o tu celular">
          <a
            href={t.correo ? '/lealtad/verificar' : '/lealtad/perfil#correo'}
            className="font-semibold underline"
          >
            {t.correo ? 'Verificar mi correo' : 'Agregar mi correo'}
          </a>
          {t.celular && !t.correo && <> o pide en caja que te manden tu enlace por WhatsApp.</>}
        </Aviso>
      )}

      {disponibles.length > 0 && (
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
          {disponibles.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent/15 text-crust-dark">
                <Icono nombre={iconoDePremio(p.posicion, programa)} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold text-ink">{p.nombre}</b>
                <span className="block text-xs text-muted">
                  Estampa {p.posicion} · tarjeta {p.ciclo} · desde el {fechaLarga(p.generado)}
                </span>
              </span>
              <span className="rounded-full bg-disponible/10 px-2.5 py-0.5 text-xs font-semibold text-disponible">
                Disponible
              </span>
            </li>
          ))}
        </ul>
      )}

      <section className="grid gap-2">
        <h2 className="font-sans text-[11px] font-semibold text-muted">Qué incluye cada premio</h2>
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
          {programa.hitos.map((h) => (
            <li key={h.posicion} className="flex items-start gap-3 px-3.5 py-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-crumb text-ink-soft">
                <Icono nombre={iconoDePremio(h.posicion, programa)} />
              </span>
              <span className="text-sm text-ink-soft">
                <b className="block text-[15px] font-semibold text-ink">
                  {h.nombre} · {h.posicion} estampas
                </b>
                {h.incluye}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {entregados.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-sans text-[11px] font-semibold text-muted">Ya entregados</h2>
          <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
            {entregados.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
                <Icono nombre="palomita" className="text-disponible" />
                <span className="min-w-0 flex-1 text-ink-soft">
                  <b className="font-semibold text-ink">{p.nombre}</b>
                  {p.entregado ? ` · ${fechaLarga(p.entregado)}` : ''}
                  {p.sucursalEntrega ? ` · ${p.sucursalEntrega}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NavTarjeta actual="/lealtad/premios" premiosListos={disponibles.length} />
    </>
  );
}
