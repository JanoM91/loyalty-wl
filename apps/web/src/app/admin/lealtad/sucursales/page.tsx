import type { Metadata } from 'next';
import { prisma } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { fechaCivil } from '@/lib/lealtad/formato';
import { qrSvg, urlAfiliacion } from '@/lib/lealtad/qr';
import { alternarParticipacion } from './acciones';

export const metadata: Metadata = { title: 'Sucursales del programa' };
export const dynamic = 'force-dynamic';

/**
 * Qué sucursales participan y su código de mostrador.
 *
 * El código de mostrador es distinto del de cada tarjeta: lleva a la portada
 * del programa y registra en qué sucursal se dio de alta cada cliente.
 */
export default async function SucursalesLealtadPage() {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const [sucursales, cuentas] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, loyaltyEnabled: true, loyaltySince: true },
    }),
    prisma.userAccount.groupBy({
      by: ['branchId'],
      where: { role: 'SUCURSAL', isActive: true },
      _count: { _all: true },
    }),
  ]);

  const urls = await Promise.all(sucursales.map((s) => urlAfiliacion(s.slug)));
  const codigos = await Promise.all(urls.map((u) => qrSvg(u)));

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Sucursales y carteles QR"
      descripcion="Enciende cada sucursal el día que su personal ya practicó la caja. Apagarla no borra nada: solo deja de acreditar y de entregar premios."
    >
      <ul className="grid gap-4 md:grid-cols-3">
        {sucursales.map((s, i) => {
          const conCuenta = cuentas.find((c) => c.branchId === s.id)?._count._all ?? 0;
          return (
            <li
              key={s.id}
              className="grid content-start gap-3 rounded-lg border border-rule bg-cream p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg text-ink">{s.name}</h2>
                  <p className="text-xs text-muted">
                    {s.loyaltyEnabled
                      ? `Participa${s.loyaltySince ? ` desde el ${fechaCivil(s.loyaltySince)}` : ''}`
                      : 'Todavía no participa'}
                  </p>
                </div>
                <form action={alternarParticipacion}>
                  <input type="hidden" name="slug" value={s.slug} />
                  <input type="hidden" name="participa" value={s.loyaltyEnabled ? '0' : '1'} />
                  <button
                    type="submit"
                    role="switch"
                    aria-checked={s.loyaltyEnabled}
                    aria-label={`${s.name} participa en el programa`}
                    className={`relative h-7 w-12 flex-none rounded-full transition-colors ${s.loyaltyEnabled ? 'bg-disponible' : 'bg-[#cbbca6]'}`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${s.loyaltyEnabled ? 'left-6' : 'left-1'}`}
                    />
                  </button>
                </form>
              </div>

              {conCuenta === 0 && (
                <p className="rounded-md bg-agotado/10 px-3 py-2 text-xs text-agotado">
                  No tiene cuenta de caja. Créala con{' '}
                  <code className="font-mono">pnpm admin:usuario</code> y rol SUCURSAL.
                </p>
              )}

              <figure className="grid justify-items-center gap-2 rounded-md bg-white p-3">
                <div
                  className="aspect-square w-40 [&_svg]:h-full [&_svg]:w-full"
                  role="img"
                  aria-label={`Código de mostrador de ${s.name}`}
                  dangerouslySetInnerHTML={{ __html: codigos[i]! }}
                />
                <figcaption className="text-center text-xs text-ink-soft">
                  Código de mostrador
                  <span className="block font-mono text-[11px] break-all text-muted">
                    {urlAfiliacion(s.slug)}
                  </span>
                </figcaption>
              </figure>
              <a
                href={`/admin/lealtad/sucursales/cartel/${s.slug}`}
                target="_blank"
                className="text-sm text-crust-dark underline underline-offset-4"
              >
                Abrir cartel para imprimir
              </a>
            </li>
          );
        })}
      </ul>
    </MarcoPanel>
  );
}
