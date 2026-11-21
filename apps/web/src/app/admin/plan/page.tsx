import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { estadoComercialDe } from '@wl/database';
import { diasRestantesDePrueba, fechaDeBorrado } from '@wl/domain';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { exigirRol } from '@/lib/admin/sesion';
import { exigirNegocio, ruta, sitioDeLaPeticion } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Mi plan' };
export const dynamic = 'force-dynamic';

const TARJETA =
  'rounded-[22px] border-[1.5px] border-[#CDE8DC] bg-white p-5 shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]';

const fecha = (d: Date) =>
  d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' });

/**
 * Mi plan: en qué va el club (prueba, pausa o pagado) y cómo activarlo. El
 * cobro se hace por WhatsApp con un enlace de pago; la activación la hace
 * club-lealtad desde /plataforma.
 */
export default async function PlanPage() {
  const sesion = await exigirRol(['ADMIN', 'DUENO']);
  const [negocio, sitio] = await Promise.all([exigirNegocio(), sitioDeLaPeticion()]);
  // Solo los clubes del asistente pagan el plan Lite; los demás tienen su propio trato.
  if (!negocio.ajustes.alta) redirect(await ruta('/admin'));
  const { pruebaVence, pagadoHasta } = negocio.ajustes;
  const estado = estadoComercialDe(negocio);
  const dias = diasRestantesDePrueba(pruebaVence);
  const borrado = fechaDeBorrado(pruebaVence, pagadoHasta);
  const mensaje = (plan: string) =>
    enlaceWhatsAppServicio(
      `Hola, quiero activar el club de ${negocio.nombre} (${sitio}/${negocio.slug}) con el pago ${plan}.`,
    );

  let titulo = 'Tu club está activo';
  let texto = 'Tu club funciona sin límites.';
  if (estado === 'PRUEBA') {
    titulo = dias === 1 ? 'Te queda 1 día de prueba' : `Te quedan ${dias} días de prueba`;
    texto =
      'Durante la prueba tienes todo: caja, tarjetas en el celular, premios y números. Actívalo antes de que termine para no pausar tu caja.';
  } else if (estado === 'PAUSADO') {
    titulo = 'Tu club está en pausa';
    texto = `La caja no suma sellos y no se crean tarjetas nuevas. Tus clientes y sus sellos siguen guardados${borrado ? ` hasta el ${fecha(borrado)}` : ''}.`;
  } else if (pagadoHasta) {
    texto = `Pagado hasta el ${fecha(new Date(pagadoHasta))}.`;
  }

  return (
    <MarcoPanel sesion={sesion} titulo="Mi plan" sinAviso>
      <div className="flex max-w-2xl flex-col gap-4">
        <section className={`${TARJETA} wl-entra ${estado === 'PAUSADO' ? 'border-ink' : ''}`}>
          <h2 className="text-[24px]">{titulo}</h2>
          <p className="mt-1.5 text-[15px] text-[#3C5A51]">{texto}</p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className={TARJETA}>
            <span className="text-[14px] font-semibold text-[#3C5A51]">Mensual</span>
            <p className="mt-1 font-display text-[34px] leading-none font-extrabold">$269</p>
            <p className="mt-1 text-[14px] text-[#3C5A51]">al mes, IVA incluido</p>
            <a
              href={mensaje('mensual')}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] border-[1.5px] border-ink px-4 font-semibold text-ink"
            >
              Activar mensual
            </a>
          </section>
          <section className={`${TARJETA} border-ink`}>
            <span className="text-[14px] font-semibold text-[#3C5A51]">Anual · ahorras $529</span>
            <p className="mt-1 font-display text-[34px] leading-none font-extrabold">$2,699</p>
            <p className="mt-1 text-[14px] text-[#3C5A51]">al año, IVA incluido</p>
            <a
              href={mensaje('anual')}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-ink px-4 font-semibold text-cream"
            >
              Activar anual
            </a>
          </section>
        </div>

        <p className="text-[14px] text-[#3C5A51]">
          Te escribimos por WhatsApp con el enlace de pago y activamos tu club en cuanto se
          acredita. Si necesitas factura, pídela en el mismo chat.
        </p>
      </div>
    </MarcoPanel>
  );
}
