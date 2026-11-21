import { estadoComercialDe } from '@wl/database';
import { diasRestantesDePrueba, fechaDeBorrado } from '@wl/domain';

import type { Sesion } from '@/lib/admin/sesion';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { exigirNegocio, sitioDeLaPeticion } from '@/lib/negocio';

const PRECIO = '$269 al mes o $2,699 al año, IVA incluido';

/**
 * Aviso en todo el panel de un club del asistente: los últimos dos días de
 * prueba y la pausa. Al dueño le da el WhatsApp para pagar; al personal de
 * caja solo le explica qué pasa.
 */
export async function AvisoClub({ sesion }: { sesion: Sesion }) {
  const negocio = await exigirNegocio();
  const { pruebaVence, pagadoHasta } = negocio.ajustes;
  const estado = estadoComercialDe(negocio);
  const dias = diasRestantesDePrueba(pruebaVence);
  if (estado === 'ACTIVO' || (estado === 'PRUEBA' && dias > 2)) return null;

  const duenio = sesion.rol === 'DUENO' || sesion.rol === 'ADMIN';
  const sitio = await sitioDeLaPeticion();
  const pagar = enlaceWhatsAppServicio(
    `Hola, quiero activar el club de ${negocio.nombre} (${sitio}/${negocio.slug}).`,
  );
  const borrado = fechaDeBorrado(pruebaVence, pagadoHasta);
  const pausa = estado === 'PAUSADO';

  return (
    <div
      role="status"
      className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-4 text-[15px] ${pausa ? 'bg-agotado/10 text-ink' : 'bg-crumb text-ink'}`}
    >
      <p className="max-w-prose">
        {pausa ? (
          <>
            <b className="font-semibold">Tu club está en pausa.</b> La caja no suma sellos y no se
            crean tarjetas nuevas. Tus clientes y sus sellos siguen guardados
            {borrado
              ? ` hasta el ${borrado.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'long' })}`
              : ''}
            .
          </>
        ) : (
          <>
            <b className="font-semibold">
              {dias === 1 ? 'Te queda 1 día de prueba.' : `Te quedan ${dias} días de prueba.`}
            </b>{' '}
            Para seguir sin pausas: {PRECIO}.
          </>
        )}
      </p>
      {duenio ? (
        <a
          href={pagar}
          className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 font-semibold text-cream"
        >
          {pausa ? 'Activar mi club' : 'Quiero seguir'}
        </a>
      ) : (
        <span className="text-[14px] text-muted">Avísale al dueño del negocio.</span>
      )}
    </div>
  );
}
