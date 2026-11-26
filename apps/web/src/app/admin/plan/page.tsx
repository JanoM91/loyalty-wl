import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { estadoComercialDe, solicitudPrivada } from '@wl/database';
import {
  ahorroAnual,
  diasRestantesDePrueba,
  fechaDeBorrado,
  origenArcade,
  pesos,
} from '@wl/domain';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { exigirRol } from '@/lib/admin/sesion';
import { exigirNegocio, ruta, rutaBase, sitioDeLaPeticion } from '@/lib/negocio';
import { PRIVADA } from '@/lib/planes';
import { precios } from '@/lib/precios';

import { PedirPrivada, SolicitudRecibida } from './PedirPrivada';

export const metadata: Metadata = { title: 'Mi plan' };
export const dynamic = 'force-dynamic';

const TARJETA =
  'rounded-[22px] border-[1.5px] border-[#E8D8C6] bg-white p-5 shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]';

const fecha = (d: Date) =>
  d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' });

/**
 * Mi plan: en qué va el club (prueba, pausa o pagado) y cómo activarlo. El
 * cobro se hace por WhatsApp con un enlace de pago; la activación la hace
 * club-lealtad desde /plataforma. Abajo, Privada: el dueño puede pedir el
 * cambio (queda la solicitud; el plan lo cambia la plataforma tras la demo).
 */
export default async function PlanPage() {
  const sesion = await exigirRol(['ADMIN', 'DUENO']);
  const [negocio, sitio, { lite, arcade }, solicitud] = await Promise.all([
    exigirNegocio(),
    sitioDeLaPeticion(),
    precios(),
    solicitudPrivada(),
  ]);
  const base = await rutaBase();
  const ahorro = ahorroAnual(lite);
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

  const mensajePrivada = enlaceWhatsAppServicio(
    `Hola, quiero pasar el club de ${negocio.nombre} (${sitio}/${negocio.slug}) a Privada.`,
  );

  let titulo = 'Tu club está activo';
  let texto = 'Tu club funciona sin límites.';
  if (estado === 'PRUEBA') {
    titulo = dias === 1 ? 'Te queda 1 día de prueba' : `Te quedan ${dias} días de prueba`;
    texto =
      'Durante la prueba tienes todo: caja, tarjetas en el celular, premios, números y Juega y gana. Actívalo antes de que termine para no pausar tu caja.';
  } else if (estado === 'PAUSADO') {
    titulo = 'Tu club está en pausa';
    texto = `La caja no suma sellos y no se crean tarjetas nuevas. Tus clientes y sus sellos siguen guardados${borrado ? ` hasta el ${fecha(borrado)}` : ''}.`;
  } else if (pagadoHasta) {
    texto = `Pagado hasta el ${fecha(new Date(pagadoHasta))}.`;
  }

  const origenJuegos = origenArcade(negocio.ajustes.arcade, pruebaVence);
  const pagadoJuegos = negocio.ajustes.arcade?.pagadoHasta;
  const textoJuegos =
    origenJuegos === 'PAGADO' && pagadoJuegos
      ? `Activo, pagado hasta el ${fecha(new Date(pagadoJuegos))}.`
      : origenJuegos === 'PRUEBA' && pruebaVence
        ? `Incluido en tu prueba hasta el ${fecha(new Date(pruebaVence))}. Al terminar, tus clientes dejan de ver los juegos si no lo activas.`
        : 'Juegos con tu marca dentro de la tarjeta de tus clientes, con retos y promociones que se cobran en tu caja.';

  return (
    <MarcoPanel sesion={sesion} titulo="Mi plan" sinAviso>
      <div className="flex max-w-2xl flex-col gap-4">
        <section className={`${TARJETA} wl-entra ${estado === 'PAUSADO' ? 'border-ink' : ''}`}>
          <h2 className="text-[24px]">{titulo}</h2>
          <p className="mt-1.5 text-[15px] text-[#5A4F63]">{texto}</p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className={TARJETA}>
            <span className="text-[14px] font-semibold text-[#5A4F63]">Mensual</span>
            <p className="mt-1 font-display text-[34px] leading-none font-extrabold">
              {lite.mes !== null ? pesos(lite.mes) : 'Pregúntanos'}
            </p>
            <p className="mt-1 text-[14px] text-[#5A4F63]">al mes, IVA incluido</p>
            <a
              href={mensaje('mensual')}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] border-[1.5px] border-ink px-4 font-semibold text-ink"
            >
              Activar mensual
            </a>
          </section>
          <section className={`${TARJETA} border-ink`}>
            <span className="text-[14px] font-semibold text-[#5A4F63]">
              Anual{ahorro ? ` · ahorras ${pesos(ahorro)}` : ''}
            </span>
            <p className="mt-1 font-display text-[34px] leading-none font-extrabold">
              {lite.anio !== null ? pesos(lite.anio) : 'Pregúntanos'}
            </p>
            <p className="mt-1 text-[14px] text-[#5A4F63]">al año, IVA incluido</p>
            <a
              href={mensaje('anual')}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-ink px-4 font-semibold text-cream"
            >
              Activar anual
            </a>
          </section>
        </div>

        <section className={`${TARJETA} grid gap-2`}>
          <span className="text-[14px] font-semibold text-[#5A4F63]">Servicio adicional</span>
          <h2 className="text-[22px]">Juega y gana</h2>
          <p className="text-[15px] text-[#5A4F63]">
            {textoJuegos}{' '}
            {arcade.mes !== null
              ? `${origenJuegos === 'PRUEBA' ? 'Para seguir después: ' : ''}${pesos(arcade.mes)} al mes${arcade.anio !== null ? ` o ${pesos(arcade.anio)} al año` : ''}.`
              : ''}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`${base}/admin/arcade`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-[16px] border-[1.5px] border-ink px-5 font-semibold text-ink"
            >
              Ver Juega y gana
            </a>
            {origenJuegos !== 'PAGADO' && (
              <a
                href={enlaceWhatsAppServicio(
                  `Hola, quiero activar «Juega y gana» en el club de ${negocio.nombre} (${sitio}/${negocio.slug}).`,
                )}
                className="inline-flex min-h-[48px] items-center justify-center rounded-[16px] bg-ink px-5 font-semibold text-cream"
              >
                Lo quiero
              </a>
            )}
          </div>
        </section>

        {negocio.ajustes.plan !== 'PRIVADA' && (
          <section id="privada" className={`${TARJETA} grid scroll-mt-24 gap-3`}>
            <span className="text-[14px] font-semibold text-[#5A4F63]">Cuando tu marca crezca</span>
            <h2 className="text-[22px]">Privada</h2>
            <p className="text-[15px] text-[#5A4F63]">
              {PRIVADA.frase} {PRIVADA.precio}: {PRIVADA.nota.charAt(0).toLowerCase()}
              {PRIVADA.nota.slice(1)}
            </p>
            <ul className="grid gap-1.5 text-[15px] text-ink">
              {PRIVADA.incluye.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden className="font-bold">
                    ✓
                  </span>
                  {x}
                </li>
              ))}
            </ul>
            <p className="text-[15px] text-[#5A4F63]">{PRIVADA.migracion}</p>
            {solicitud ? (
              <SolicitudRecibida
                fechaIso={solicitud.fecha.toISOString()}
                whatsapp={mensajePrivada}
              />
            ) : (
              <PedirPrivada whatsapp={mensajePrivada} />
            )}
          </section>
        )}

        <p className="text-[14px] text-[#5A4F63]">
          Te escribimos por WhatsApp con el enlace de pago y activamos tu club en cuanto se
          acredita. Si necesitas factura, pídela en el mismo chat.
        </p>
      </div>
    </MarcoPanel>
  );
}
