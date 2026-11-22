import type { Metadata } from 'next';
import { ROLES_USUARIOS, arcadeDelNegocio, resumenArcade } from '@wl/database';
import { ahorroAnual, pesos } from '@wl/domain';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirRol } from '@/lib/admin/sesion';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { temaArcade } from '@/lib/lealtad/arcade';
import { exigirNegocio, sitioDeLaPeticion } from '@/lib/negocio';
import { precios } from '@/lib/precios';

import { FormularioArcade } from './FormularioArcade';

export const metadata: Metadata = { title: 'Juega y gana' };
export const dynamic = 'force-dynamic';

const TARJETA =
  'rounded-[22px] border-[1.5px] border-[#E8D8C6] bg-white p-5 shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'long',
  });

/**
 * «Juega y gana» (Arcade del club) para el dueño: qué es y cuánto cuesta si
 * no lo tiene; su estado, la semana en números y la configuración si lo tiene.
 * Lo enciende y cobra club-lealtad desde /plataforma.
 */
export default async function ArcadePage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const [negocio, sitio, { arcade: precio }, datos] = await Promise.all([
    exigirNegocio(),
    sitioDeLaPeticion(),
    precios(),
    arcadeDelNegocio(),
  ]);
  const { permisos, config, vigente } = datos;
  const pedir = (texto: string) =>
    enlaceWhatsAppServicio(`${texto} (${negocio.nombre}, ${sitio}/${negocio.slug}).`);
  const ahorro = ahorroAnual(precio);
  const precioTexto =
    precio.mes !== null
      ? `${pesos(precio.mes)} al mes${precio.anio !== null ? ` o ${pesos(precio.anio)} al año` : ''}${ahorro ? ` (ahorras ${pesos(ahorro)})` : ''}, IVA incluido.`
      : 'Te damos el precio por WhatsApp.';

  if (!permisos?.activo) {
    return (
      <MarcoPanel
        sesion={sesion}
        titulo="Juega y gana"
        descripcion="Juegos con tu marca que hacen volver a tus clientes."
      >
        <div className="flex max-w-2xl flex-col gap-4">
          <section className={`${TARJETA} wl-entra grid gap-3`}>
            <h2 className="text-[24px]">Un arcade con tus productos dentro de su tarjeta</h2>
            <ul className="grid list-disc gap-1.5 pl-5 text-[15px] text-[#5A4F63]">
              <li>
                Seis juegos sencillos para el celular (atrapa, memorama, sopa de letras y más), con
                tus colores, tu inicial y tus productos.
              </li>
              <li>
                Tus clientes juegan unas partidas al día y completan retos de la semana o del mes.
              </li>
              <li>
                Cada reto les da una promoción que tú decides y que se cobra en tu caja con un
                código, una sola vez.
              </li>
              <li>Sin sorteos: son juegos de habilidad y constancia.</li>
            </ul>
            <p className="text-[15px] font-semibold text-ink">{precioTexto}</p>
            <a
              href={pedir('Hola, quiero activar «Juega y gana» en mi club')}
              className="inline-flex min-h-[48px] items-center justify-center justify-self-start rounded-[16px] bg-ink px-6 font-semibold text-cream"
            >
              Lo quiero
            </a>
          </section>
        </div>
      </MarcoPanel>
    );
  }

  const semana = await resumenArcade();
  const tema = temaArcade(negocio, config.productos, config.palabras);

  return (
    <MarcoPanel
      sesion={sesion}
      titulo="Juega y gana"
      descripcion="Juegos, retos y promociones dentro de la tarjeta de tus clientes."
    >
      <div className="grid gap-8">
        <section className={`${TARJETA} grid max-w-3xl gap-3`}>
          {vigente ? (
            <p className="text-[15px] text-[#5A4F63]">
              <b className="text-ink">Activo</b>
              {permisos.pagadoHasta ? ` · pagado hasta el ${fecha(permisos.pagadoHasta)}` : ''}. Tus
              clientes lo ven en su tarjeta, en «Juega y gana».
            </p>
          ) : (
            <div className="grid gap-2">
              <p className="text-[15px] text-[#5A4F63]">
                <b className="text-ink">Vencido</b>
                {permisos.pagadoHasta ? ` el ${fecha(permisos.pagadoHasta)}` : ''}. Tus clientes ya
                no ven los juegos; las promociones que ganaron se pueden cobrar hasta que venzan.
              </p>
              <p className="text-[14px] text-[#5A4F63]">{precioTexto}</p>
              <a
                href={pedir('Hola, quiero renovar «Juega y gana» en mi club')}
                className="inline-flex min-h-[48px] items-center justify-center justify-self-start rounded-[16px] bg-ink px-6 font-semibold text-cream"
              >
                Renovar por WhatsApp
              </a>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['Partidas', semana.partidas],
                ['Jugadores', semana.jugadores],
                ['Promociones ganadas', semana.cuponesGanados],
                ['Cobradas en caja', semana.cuponesCobrados],
              ] as const
            ).map(([t, v]) => (
              <div key={t} className="grid gap-0.5">
                <dt className="text-[13px] text-[#5A4F63]">{t}</dt>
                <dd className="font-display text-[28px] leading-none font-extrabold tabular-nums">
                  {v.toLocaleString('es-MX')}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-[#5A4F63]">Esta semana, desde el lunes.</p>
        </section>

        <FormularioArcade permisos={permisos} config={config} tema={tema} />
      </div>
    </MarcoPanel>
  );
}
