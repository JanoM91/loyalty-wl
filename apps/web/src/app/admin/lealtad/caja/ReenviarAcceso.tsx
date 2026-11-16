'use client';

import { useState } from 'react';
import { HORAS_ENLACE_REENVIO, vigenciaEnlace, type CanalReenvio } from '@wl/domain';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono } from '@/components/lealtad/Iconos';
import { reenviarAcceso, type RespuestaReenvio } from './reenvio';

/** Último enlace que la caja mandó para esta tarjeta en esta pantalla. */
export interface EnvioReenvio {
  readonly r: Extract<RespuestaReenvio, { ok: true }>;
  /** Se abrió WhatsApp solo; si el navegador lo bloqueó, se ofrece el enlace. */
  readonly abrioVentana: boolean;
}

/**
 * «Volver a mandar el enlace» de una tarjeta que ya existe.
 *
 * Para quien tiene tarjeta pero no la tiene abierta en su celular: no abrió a
 * tiempo la bienvenida (dura 3 días), cambió de celular o cerró sesión. El
 * enlace va al contacto **registrado** de la tarjeta (WhatsApp o correo) o se
 * muestra en QR para que lo escanee ahí mismo. Al abrirlo crea su contraseña
 * si todavía no tiene.
 *
 * El último envío lo guarda la pantalla de arriba (`enviado`) para que siga a
 * la vista después de acreditar la visita.
 *
 * La pestaña de WhatsApp se abre antes de esperar al servidor: Safari del
 * iPad bloquea las ventanas que se abren después de una espera.
 */
export function ReenviarAcceso({
  codigo,
  sucursalSlug,
  tieneCelular,
  tieneCorreo,
  abrioTarjeta,
  enviado,
  onEnviado,
}: {
  codigo: string;
  sucursalSlug: string;
  tieneCelular: boolean;
  tieneCorreo: boolean;
  /** Si ya abrió su tarjeta en algún celular; null si no se sabe. */
  abrioTarjeta: boolean | null;
  enviado: EnvioReenvio | null;
  onEnviado: (e: EnvioReenvio) => void;
}) {
  const [ocupado, setOcupado] = useState<CanalReenvio | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mandar(canal: CanalReenvio) {
    setError(null);
    setOcupado(canal);
    const ventana = canal === 'WHATSAPP' ? window.open('', '_blank') : null;
    let r: RespuestaReenvio;
    try {
      r = await reenviarAcceso({ codigo, sucursalSlug, canal });
    } catch {
      r = {
        ok: false,
        error: 'No se pudo preparar el enlace. Revisa la conexión e inténtalo otra vez.',
      };
    }
    setOcupado(null);
    if (!r.ok) {
      ventana?.close();
      setError(r.error);
      return;
    }
    if (r.canal === 'WHATSAPP' && ventana) {
      ventana.opener = null;
      ventana.location.href = r.whatsapp;
    }
    onEnviado({ r, abrioVentana: Boolean(ventana) });
  }

  const pendiente = abrioTarjeta === false;
  const e = enviado?.r;

  return (
    <section
      className={`grid gap-3 rounded-lg bg-cream p-4 ${
        pendiente ? 'border-[1.5px] border-crust' : 'border border-rule'
      }`}
    >
      <div className="grid gap-1">
        <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Icono nombre="tarjeta" className="flex-none text-crust-dark" />
          {pendiente ? 'Todavía no abre su tarjeta en el celular' : 'Su tarjeta en el celular'}
        </h3>
        <p className="text-sm text-ink-soft">
          {pendiente
            ? 'Mándale el enlace de nuevo para que la abra, cree su contraseña y la guarde en su celular.'
            : '¿Ya no la tiene abierta en su celular? Mándale un enlace nuevo.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tieneCelular && (
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => mandar('WHATSAPP')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm bg-[#1f8f5a] px-5 font-semibold text-cream hover:bg-[#19764a] disabled:opacity-50"
          >
            {ocupado === 'WHATSAPP'
              ? 'Preparando…'
              : e?.canal === 'WHATSAPP'
                ? 'Mandar otra vez por WhatsApp'
                : 'Mandar enlace por WhatsApp'}
          </button>
        )}
        {tieneCorreo && (
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => mandar('CORREO')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-sm border-[1.5px] border-ink px-5 font-semibold text-ink hover:bg-white disabled:opacity-50"
          >
            <Icono nombre="correo" width={18} height={18} />
            {ocupado === 'CORREO'
              ? 'Enviando…'
              : e?.canal === 'CORREO'
                ? 'Mandar otra vez por correo'
                : 'Mandar enlace por correo'}
          </button>
        )}
      </div>
      <button
        type="button"
        disabled={ocupado !== null}
        onClick={() => mandar('PANTALLA')}
        className="justify-self-start text-sm text-crust-dark underline underline-offset-4 disabled:opacity-50"
      >
        {ocupado === 'PANTALLA' ? 'Generando QR…' : 'O mostrar un QR para que lo escanee aquí'}
      </button>

      {error && <Aviso tono="error">{error}</Aviso>}

      {e?.canal === 'WHATSAPP' && (
        <Aviso tono="ok" titulo="WhatsApp listo con su enlace">
          Va al celular registrado ({e.contacto}). Toca «Enviar» en WhatsApp y pídele que lo abra en
          Safari o Chrome. Es su enlace personal ({e.vence}).{' '}
          {!enviado?.abrioVentana && (
            <a
              href={e.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              Abrir WhatsApp
            </a>
          )}
        </Aviso>
      )}
      {e?.canal === 'CORREO' && (
        <Aviso tono="ok" titulo="Enlace enviado por correo">
          Le llegó a {e.contacto}. Si no lo ve, que revise la carpeta de no deseados. Es su enlace
          personal ({e.vence}).
        </Aviso>
      )}
      {e?.canal === 'PANTALLA' && (
        <div className="grid justify-items-center gap-2 rounded-md bg-white p-3">
          <div
            role="img"
            aria-label={`Código QR de acceso a la tarjeta ${codigo}`}
            className="w-48 max-w-full [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: e.svg }}
          />
          <p className="text-center text-sm text-ink-soft">
            Que lo escanee con la cámara de su celular y toque «Abrir mi tarjeta».
          </p>
          <p className="text-xs text-muted">Es su enlace personal ({e.vence}).</p>
        </div>
      )}

      <p className="text-xs text-muted">
        Se manda su enlace personal, que no vence ni pide contraseña. Abrirlo desde WhatsApp o el
        correo verifica ese contacto durante {vigenciaEnlace(HORAS_ENLACE_REENVIO * 60)}.
      </p>
    </section>
  );
}
