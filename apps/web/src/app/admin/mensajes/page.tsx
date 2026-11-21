import type { Metadata } from 'next';
import {
  LIMITES_MENSAJE,
  ROLES_USUARIOS,
  audienciaMensajes,
  historialMensajes,
  siguienteMensajePosible,
  usoMensajesDelMes,
} from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirRol } from '@/lib/admin/sesion';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { CORREO_CONFIGURADO } from '@/lib/correo';
import { exigirNegocio, sitioDeLaPeticion } from '@/lib/negocio';

import { FormularioMensaje } from './FormularioMensaje';

export const metadata: Metadata = { title: 'Mensajes a clientes' };
export const dynamic = 'force-dynamic';

const TARJETA =
  'rounded-[22px] border-[1.5px] border-[#CDE8DC] bg-white p-5 shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]';
const SUAVE = 'text-[#3C5A51]';

const cuando = (d: Date) =>
  d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

/**
 * «Mensajes a clientes»: el dueño escribe un correo para quienes aceptaron
 * promociones. club-lealtad lo enciende y fija el tope mensual en /plataforma.
 */
export default async function MensajesPage() {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const [negocio, sitio] = await Promise.all([exigirNegocio(), sitioDeLaPeticion()]);
  const ajustes = negocio.ajustes.mensajes;

  if (!ajustes?.activo) {
    const pedir = enlaceWhatsAppServicio(
      `Hola, quiero activar «Mensajes a clientes» en mi club (${negocio.nombre}, ${sitio}/${negocio.slug}).`,
    );
    return (
      <MarcoPanel
        sesion={sesion}
        titulo="Mensajes a clientes"
        descripcion="Escríbeles a tus clientes por correo."
      >
        <section className={`${TARJETA} wl-entra grid max-w-2xl gap-3`}>
          <h2 className="text-[22px]">Avisa tus promociones a quien ya te conoce</h2>
          <ul className={`grid list-disc gap-1.5 pl-5 text-[15px] ${SUAVE}`}>
            <li>Escribes el mensaje y llega a quienes aceptaron promociones en su tarjeta.</li>
            <li>
              Cada correo lleva tu nombre, el botón «Ver mi tarjeta» y el enlace para darse de baja.
            </li>
            <li>Te mandas una prueba antes de enviarlo.</li>
          </ul>
          <a
            href={pedir}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center self-start rounded-full bg-ink px-5 text-[15px] font-semibold text-cream"
          >
            Pedirlo por WhatsApp
          </a>
        </section>
      </MarcoPanel>
    );
  }

  const [audiencia, uso, siguiente, historial] = await Promise.all([
    audienciaMensajes(),
    usoMensajesDelMes(),
    siguienteMensajePosible(),
    historialMensajes(10),
  ]);
  const restante = Math.max(0, ajustes.topeMensual - uso);
  const motivo = !CORREO_CONFIGURADO
    ? 'El envío de correos todavía no está activo.'
    : siguiente
      ? `Ya mandaste un mensaje hoy. El siguiente puede salir el ${cuando(siguiente)}`
      : audiencia === 0
        ? 'Todavía no hay clientes que hayan aceptado promociones con su correo verificado.'
        : audiencia > restante
          ? `Llegaría a ${audiencia} clientes y este mes te quedan ${restante} correos.`
          : null;

  const cifra = (valor: string, texto: string) => (
    <div className={`${TARJETA} flex flex-col gap-0.5 !p-4`}>
      <span className="font-display text-[26px] leading-none font-extrabold">{valor}</span>
      <span className={`text-[13px] ${SUAVE}`}>{texto}</span>
    </div>
  );

  return (
    <MarcoPanel
      sesion={sesion}
      titulo="Mensajes a clientes"
      descripcion="Un correo para quienes aceptaron promociones. Uno al día como máximo."
    >
      <div className="grid max-w-3xl gap-5">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {cifra(audiencia.toLocaleString('es-MX'), 'clientes lo recibirían')}
          {cifra(
            restante.toLocaleString('es-MX'),
            `de ${ajustes.topeMensual.toLocaleString('es-MX')} correos este mes`,
          )}
          {cifra(siguiente ? cuando(siguiente) : 'Ahora', 'próximo envío')}
        </div>

        <section className={TARJETA}>
          <FormularioMensaje audiencia={audiencia} puedeEnviar={motivo} limites={LIMITES_MENSAJE} />
        </section>

        <section className="grid gap-2">
          <h2 className="text-[17px] font-semibold">Enviados</h2>
          {historial.length === 0 ? (
            <p className={`text-[14px] ${SUAVE}`}>Aquí verás cada mensaje y cuántos salieron.</p>
          ) : (
            <ul className="grid gap-2">
              {historial.map((m) => (
                <li key={m.id} className={`${TARJETA} !p-4`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <b className="text-[15px]">{m.asunto}</b>
                    <span className={`text-[13px] ${SUAVE}`}>{cuando(m.creado)}</span>
                  </div>
                  <p className={`text-[13px] ${SUAVE}`}>
                    {m.estado === 'ENVIANDO'
                      ? `Enviando a ${m.destinatarios}…`
                      : `${m.enviados} ${m.enviados === 1 ? 'enviado' : 'enviados'}${m.fallidos ? `, ${m.fallidos} no salieron` : ''}`}
                    {m.autor ? ` · ${m.autor}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </MarcoPanel>
  );
}
