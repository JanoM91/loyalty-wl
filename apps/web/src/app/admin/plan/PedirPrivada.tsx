'use client';

import { useActionState, useEffect } from 'react';

import { Alerta, BotonEnviar } from '@/components/admin/Formulario';

import { pedirPrivada, type EstadoPrivada } from './acciones';

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'long',
  });

/** Mensaje cuando ya hay solicitud (recién hecha o de antes). */
export function SolicitudRecibida({ fechaIso, whatsapp }: { fechaIso: string; whatsapp: string }) {
  return (
    <div className="grid gap-2">
      <Alerta tono="ok">
        Recibimos tu solicitud el {fecha(fechaIso)}. Te escribimos por WhatsApp para agendar la demo
        y cotizar. Mientras, tu club sigue igual.
      </Alerta>
      <a href={whatsapp} className="text-[14px] text-ink underline underline-offset-4">
        ¿Prisa? Escríbenos por WhatsApp
      </a>
    </div>
  );
}

/** «Quiero pasar a Privada»: una nota opcional y un botón. */
export function PedirPrivada({ whatsapp }: { whatsapp: string }) {
  const [estado, enviar] = useActionState<EstadoPrivada | null, FormData>(pedirPrivada, null);

  // Next 15.5 a veces no actualiza la pantalla tras una acción en la misma
  // página (visto también en la plataforma): con éxito, carga completa, que ya
  // trae la solicitud desde la base.
  useEffect(() => {
    if (estado?.ok) window.location.assign(`${window.location.pathname}?privada=1#privada`);
  }, [estado]);

  if (estado?.ok && estado.fecha) {
    return <SolicitudRecibida fechaIso={estado.fecha} whatsapp={whatsapp} />;
  }

  return (
    <form action={enviar} className="grid gap-3">
      <label htmlFor="nota-privada" className="grid gap-1.5 text-[14px] font-medium text-ink">
        ¿Algo que debamos saber? (opcional)
        <textarea
          id="nota-privada"
          name="nota"
          maxLength={500}
          rows={3}
          placeholder="Por ejemplo: cuántas sucursales tienes o el dominio que te gustaría."
          className="rounded-[14px] border-[1.5px] border-[#E8D8C6] bg-white px-3 py-2 text-[15px] font-normal text-ink"
        />
      </label>
      {estado?.error && <Alerta tono="error">{estado.error}</Alerta>}
      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar texto="Quiero pasar a Privada" enviando="Enviando…" />
        <a href={whatsapp} className="text-[14px] text-ink underline underline-offset-4">
          Prefiero escribir por WhatsApp
        </a>
      </div>
      <p className="text-[13px] text-[#5A4F63]">
        No cambia nada de tu club ni se cobra nada: solo nos avisa que quieres la demo.
      </p>
    </form>
  );
}
