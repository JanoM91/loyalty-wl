'use client';

import { useEffect, useState } from 'react';

import { Aviso } from './Aviso';

/**
 * Aviso para quien abre el enlace de acceso dentro de otra app.
 *
 * WhatsApp (en iPhone), Instagram, Facebook y Messenger abren los enlaces en
 * un navegador propio que no comparte sesión con Safari ni con Chrome. Si la
 * persona abre su tarjeta ahí, la cookie de 400 días se queda en ese
 * navegador escondido y al día siguiente, al entrar por Safari o Chrome,
 * parece que «se cerró la sesión». Es la causa más común de ese reporte.
 *
 * Por eso el aviso va en la página del enlace, antes de gastarlo: desde aquí
 * la persona todavía puede abrir la misma dirección en su navegador y
 * consumirlo allí. En Android e Instagram/Facebook se detecta por el agente
 * de usuario; en WhatsApp de iPhone no se puede distinguir de Safari, así que
 * a todos se les muestra la versión suave.
 */
export function AvisoNavegadorIntegrado() {
  const [estado, setEstado] = useState<{
    integrado: boolean;
    android: boolean;
    url: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [mostrarEnlace, setMostrarEnlace] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const android = /Android/i.test(ua);
    const integrado =
      /\bwv\b/.test(ua) || // WebView de Android
      (android && /Version\/\d/.test(ua) && /Chrome/.test(ua)) || // WebView con UA de Chrome
      /Instagram|FBAN|FBAV|FB_IAB|Messenger|Line\/|musical_ly|BytedanceWebview|TikTok|Twitter/i.test(
        ua,
      );
    setEstado({ integrado, android, url: window.location.href });
  }, []);

  if (!estado) return null;

  const url = estado.url;
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setMostrarEnlace(true);
    }
  }

  const intentChrome = estado.android
    ? `intent://${estado.url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
    : null;

  const acciones = (
    <span className="mt-2 flex flex-wrap gap-3">
      {intentChrome && (
        <a href={intentChrome} className="font-semibold underline underline-offset-4">
          Abrir en Chrome
        </a>
      )}
      <button type="button" onClick={copiar} className="font-semibold underline underline-offset-4">
        {copiado ? 'Enlace copiado' : 'Copiar enlace'}
      </button>
    </span>
  );

  const enlaceManual = mostrarEnlace && (
    <span className="mt-2 block">
      <span className="block text-xs">
        No pudimos copiarlo solo. Toca el enlace, cópialo y pégalo en tu navegador.
      </span>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Enlace de tu tarjeta"
        className="mt-1 w-full rounded-md border border-rule bg-cream px-2 py-1 text-xs text-ink"
      />
    </span>
  );

  if (estado.integrado) {
    return (
      <Aviso tono="atencion" titulo="Ábrelo en tu navegador antes de continuar">
        Este enlace se abrió dentro de otra app. Si abres tu tarjeta aquí, mañana no la vas a
        encontrar en Safari ni en Chrome. Toca el menú de la app (⋮ o el icono de compartir) y elige
        «Abrir en el navegador», o copia el enlace y pégalo en Safari o Chrome.
        {acciones}
        {enlaceManual}
      </Aviso>
    );
  }

  return (
    <p className="text-xs text-muted">
      ¿Se abrió dentro de WhatsApp o de otra app? Mejor ábrelo en Safari o Chrome (menú de la app →
      «Abrir en el navegador») para que tu tarjeta quede guardada en tu celular.{' '}
      <button type="button" onClick={copiar} className="underline underline-offset-4">
        {copiado ? 'Enlace copiado' : 'Copiar enlace'}
      </button>
      {enlaceManual}
    </p>
  );
}
