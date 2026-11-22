import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  ROLES_USUARIOS,
  candidatosRegreso,
  cifrasDeRegalos,
  cumpleanosRegistrados,
  usoMensajesDelMes,
} from '@wl/database';
import { TOPE_DIARIO_AUTOMATICOS, fechaLocal, inicioDelDia, sumarDias } from '@wl/domain';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { Icono } from '@/components/admin/Icono';
import { exigirRol } from '@/lib/admin/sesion';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { exigirNegocio, sitioDeLaPeticion } from '@/lib/negocio';

import { FormularioRegalo } from './FormularioRegalo';

export const metadata: Metadata = { title: 'Regalos automáticos' };
export const dynamic = 'force-dynamic';

const TARJETA =
  'rounded-[22px] border-[1.5px] border-[#E8D8C6] bg-white p-5 shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]';
const SUAVE = 'text-[#5A4F63]';

const numero = (n: number) => n.toLocaleString('es-MX');
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;

/**
 * Regalos automáticos: «Te extrañamos» (a quien dejó de venir) y cumpleaños.
 * El dueño elige el regalo; club-lealtad los da cada mañana y avisa por
 * correo a quien aceptó promociones.
 */
export default async function RegalosPage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const [negocio, sitio] = await Promise.all([exigirNegocio(), sitioDeLaPeticion()]);
  const { regreso, cumple } = negocio.ajustes.regalos;
  const mensajes = negocio.ajustes.mensajes;
  const ahora = new Date();
  const hoy = fechaLocal(ahora, negocio.zonaHoraria);

  const [cifras, porRegresar, conCumple, uso] = await Promise.all([
    cifrasDeRegalos(inicioDelDia(sumarDias(hoy, -29), negocio.zonaHoraria)),
    candidatosRegreso(regreso.dias, 1000, ahora),
    cumpleanosRegistrados(),
    usoMensajesDelMes(ahora),
  ]);
  const restante = mensajes?.activo ? Math.max(0, mensajes.topeMensual - uso) : 0;
  const pedir = enlaceWhatsAppServicio(
    `Hola, quiero activar «Mensajes a clientes» en mi club (${negocio.nombre}, ${sitio}/${negocio.slug}).`,
  );

  const seccion = (
    icono: 'regalo' | 'pastel',
    titulo: string,
    encendido: boolean,
    explicacion: string,
    hijos: ReactNode,
    pie: string,
  ) => (
    <section className={`${TARJETA} grid gap-4`}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[#FFF1E6] text-ink">
          <Icono nombre={icono} />
        </span>
        <div className="grid gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-[20px]">
            {titulo}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${encendido ? 'bg-[#E9F9D6] text-[#2E5D0B]' : 'bg-[#F1ECE6] text-[#5A4F63]'}`}
            >
              {encendido ? 'Encendido' : 'Apagado'}
            </span>
          </h2>
          <p className={`text-[14px] ${SUAVE}`}>{explicacion}</p>
        </div>
      </div>
      {hijos}
      <p className={`border-t border-[#F1E6D8] pt-3 text-[13px] ${SUAVE}`}>{pie}</p>
    </section>
  );

  const r = cifras.REGRESO;
  const c = cifras.CUMPLE;

  return (
    <MarcoPanel
      sesion={sesion}
      titulo="Regalos automáticos"
      descripcion="Tu club se acuerda de tus clientes por ti: cada mañana revisa quién dejó de venir y quién cumple años."
    >
      <div className="grid max-w-3xl gap-5">
        {!mensajes?.activo && (
          <section className={`${TARJETA} grid gap-2 !p-4`}>
            <p className="text-[15px] text-ink">
              <b>Los avisos por correo necesitan «Mensajes a clientes».</b> Sin él, el regalo de
              cumpleaños igual aparece en la tarjeta y en tu caja, pero no llega el correo, y «Te
              extrañamos» no se puede encender.
            </p>
            <a
              href={pedir}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center self-start rounded-full bg-ink px-5 text-[15px] font-semibold text-cream"
            >
              Pedirlo por WhatsApp
            </a>
          </section>
        )}

        {seccion(
          'regalo',
          'Te extrañamos',
          regreso.activo,
          'A quien lleve un tiempo sin venir le llega un correo con un regalo para su próxima visita. Una vez por ausencia y, como mucho, cada 90 días.',
          <FormularioRegalo
            tipo="REGRESO"
            inicial={regreso}
            club={negocio.nombre}
            hoy={hoy}
            bloqueo={
              mensajes?.activo ? null : 'Se enciende cuando tu club tenga «Mensajes a clientes».'
            }
          />,
          [
            `Con ${regreso.dias} días, hoy le llegaría a ${plural(porRegresar.length, 'cliente', 'clientes')} (aceptaron promociones y no vienen desde hace menos de 180 días).`,
            r.dados > 0
              ? `Últimos 30 días: ${plural(r.dados, 'recibió', 'recibieron')} el regalo, ${plural(r.regresaron, 'regresó', 'regresaron')} y ${plural(r.entregados, 'lo cobró', 'lo cobraron')}.`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        )}

        {seccion(
          'pastel',
          'Cumpleaños',
          cumple.activo,
          'El día de su cumpleaños, tu cliente encuentra un regalo en su tarjeta y tu caja lo ve al escanearla. Si aceptó promociones, también le llega un correo de felicitación. Uno al año.',
          <FormularioRegalo
            tipo="CUMPLE"
            inicial={cumple}
            club={negocio.nombre}
            hoy={hoy}
            bloqueo={null}
          />,
          [
            `${plural(conCumple, 'cliente tiene', 'clientes tienen')} su cumpleaños en la tarjeta (lo piden al darse de alta y en su perfil).`,
            c.dados > 0
              ? `Últimos 30 días: ${plural(c.dados, 'regalo dado', 'regalos dados')}, ${plural(c.avisados, 'correo enviado', 'correos enviados')} y ${plural(c.entregados, 'cobrado', 'cobrados')}.`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        )}

        <p className={`text-[13px] ${SUAVE}`}>
          Los regalos salen cada mañana, alrededor de las 10. Se cobran en caja como un premio: con
          la tarjeta verificada y una sola vez.
          {mensajes?.activo
            ? ` Sus correos cuentan para tus ${numero(mensajes.topeMensual)} correos del mes (te quedan ${numero(restante)}), hasta ${TOPE_DIARIO_AUTOMATICOS} al día.`
            : ''}
        </p>
      </div>
    </MarcoPanel>
  );
}
