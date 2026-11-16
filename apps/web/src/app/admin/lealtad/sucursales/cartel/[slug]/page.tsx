import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma, programaVigente } from '@wl/database';

import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { qrSvg, urlAfiliacion } from '@/lib/lealtad/qr';
import { LogoMarca } from '@/components/Marca';
import { sitioDeLaPeticion } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Cartel de mostrador' };
export const dynamic = 'force-dynamic';

/**
 * Cartel media carta para el mostrador de cada sucursal.
 *
 * Se imprime desde el navegador (Archivo → Imprimir). Fondo crema y tinta: se
 * ve bien en impresora de color y también en blanco y negro.
 */
export default async function CartelPage({ params }: { params: Promise<{ slug: string }> }) {
  await exigirRol(ROLES_PROGRAMA);
  const { slug } = await params;
  const s = await prisma.branch.findFirst({ where: { slug }, select: { slug: true, name: true } });
  if (!s) notFound();
  const svg = await qrSvg(await urlAfiliacion(s.slug));
  const programa = await programaVigente();
  const hitos = [...programa.hitos].sort((a, b) => a.posicion - b.posicion);

  return (
    <div className="mx-auto grid min-h-screen max-w-[148mm] content-center justify-items-center gap-6 bg-cream px-8 py-10 text-center text-ink print:min-h-0">
      <LogoMarca sobre="claro" className="h-24 text-5xl" />
      <h1 className="text-4xl leading-tight text-balance">Tu visita tiene recompensa</h1>
      <p className="max-w-[34ch] text-lg text-ink-soft">
        {hitos.map((h) => `${h.posicion} estampas: ${h.nombre.toLowerCase()}.`).join(' ')}
      </p>
      <div
        className="aspect-square w-64 rounded-md bg-white p-3 [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-base font-semibold">
        Escanea con tu celular y crea tu tarjeta. No descargas nada.
      </p>
      <p className="text-sm text-muted">
        {s.name} · {await sitioDeLaPeticion()}/lealtad
      </p>
    </div>
  );
}
