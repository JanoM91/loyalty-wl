import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma, programaVigente } from '@wl/database';

import { Copiar } from '@/components/Copiar';
import { Icono } from '@/components/admin/Icono';
import { Imprimir } from '@/components/admin/Imprimir';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { qrSvg, urlAfiliacion } from '@/lib/lealtad/qr';
import { LogoMarca } from '@/components/Marca';
import { exigirNegocio, rutaBase, sitioDeLaPeticion } from '@/lib/negocio';
import { MarcaDelNegocio } from '@/components/admin/MarcaDelNegocio';
import { estiloDeMarca } from '@/lib/marca';

export const metadata: Metadata = { title: 'Tu cartel QR' };
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
  const unete = await urlAfiliacion(s.slug);
  const svg = await qrSvg(unete);
  const programa = await programaVigente();
  const hitos = [...programa.hitos].sort((a, b) => a.posicion - b.posicion);

  const [negocio, base] = await Promise.all([exigirNegocio(), rutaBase()]);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Saca tu tarjeta de cliente frecuente de ${negocio.nombre}: ${unete}`,
  )}`;
  const boton =
    'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] px-4 text-[15px] font-semibold transition-transform active:scale-[.97]';

  // El cartel es de cara al cliente: lleva la marca del negocio, no la del panel.
  // Arriba, las acciones (no se imprimen): imprimir, compartir y volver.
  return (
    <>
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5 print:hidden">
        <a
          href={`${base}/admin`}
          className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-ink"
        >
          <Icono nombre="atras" tam={18} />
          Volver al inicio
        </a>
        <div>
          <h1 className="text-[clamp(1.75rem,5vw,2.25rem)] text-ink">Pon tu QR donde cobras</h1>
          <p className="mt-1 text-[15px] text-[#3C5A51]">
            Tus clientes lo escanean y sacan su tarjeta solos. Imprímelo en tamaño carta o
            compártelo por WhatsApp.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Imprimir className={`${boton} col-span-2 bg-ink text-cream`}>
            <Icono nombre="imprimir" tam={20} />
            Imprimir o guardar en PDF
          </Imprimir>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={`${boton} border-[1.5px] border-ink bg-white text-ink`}
          >
            <Icono nombre="chat" tam={19} />
            WhatsApp
          </a>
          <Copiar
            texto={unete}
            etiqueta="Copiar enlace"
            hecho="Enlace copiado"
            className={`${boton} border-[1.5px] border-ink bg-white text-ink`}
          />
        </div>
      </div>
      <MarcaDelNegocio estilo={estiloDeMarca(negocio)} plantilla={negocio.marca.plantilla}>
        <div className="mx-auto mt-4 grid min-h-[80vh] max-w-[148mm] content-center justify-items-center gap-6 bg-cream px-8 py-10 text-center text-ink print:min-h-0">
          <LogoMarca sobre="claro" className="h-24 text-5xl" />
          <h1 className="text-4xl leading-tight text-balance">Tu visita tiene recompensa</h1>
          <p className="max-w-[34ch] text-lg text-ink-soft">
            {hitos.map((h) => `${h.posicion} sellos: ${h.nombre.toLowerCase()}.`).join(' ')}
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
      </MarcaDelNegocio>
      <div className="mx-auto max-w-xl px-5 pt-2 pb-12 print:hidden">
        <a
          href={`${base}/admin`}
          className={`${boton} w-full border-2 border-ink bg-white text-ink`}
        >
          Listo, ya lo puse
        </a>
      </div>
    </>
  );
}
