'use client';

import { useEffect, useState } from 'react';

import { Icono } from './Iconos';

/**
 * Invitación a agregar la tarjeta a la pantalla de inicio.
 *
 * - Android/Chrome: el navegador avisa con `beforeinstallprompt`; se guarda el
 *   evento y un botón lo dispara.
 * - iPhone/iPad (Safari): no hay aviso automático; se explican los dos toques
 *   (Compartir → Agregar a inicio).
 * - Ya instalada (modo standalone): no se muestra nada.
 *
 * Se puede descartar; se vuelve a ofrecer a los 14 días. Va junto a los
 * botones de Wallet: son dos maneras de tener la tarjeta a la mano.
 */

type Evento = Event & { prompt: () => Promise<void> };

const CLAVE = 'wl_instalar_descartado';
const DIAS_SILENCIO = 14;

/**
 * `forzar`: se muestra aunque la persona la haya descartado y aunque Chrome no
 * ofrezca el aviso de instalación (entonces se explica el menú ⋮). Lo usa el
 * enlace de la campaña «Guarda tu tarjeta en el celular».
 */
export function InvitacionInstalar({ forzar = false }: { forzar?: boolean }) {
  const [modo, setModo] = useState<'oculto' | 'android' | 'ios'>('oculto');
  const [evento, setEvento] = useState<Evento | null>(null);

  useEffect(() => {
    const instalada =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (instalada) return;

    try {
      const desde = Number(localStorage.getItem(CLAVE) ?? '0');
      if (!forzar && desde && Date.now() - desde < DIAS_SILENCIO * 24 * 60 * 60 * 1000) return;
    } catch {
      /* sin almacenamiento: se ofrece igual */
    }

    const ua = navigator.userAgent;
    const esIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
    if (esIos) {
      setModo('ios');
      return;
    }

    const alPoderInstalar = (e: Event) => {
      e.preventDefault();
      setEvento(e as Evento);
      setModo('android');
    };
    // Forzada: se explica el menú de Chrome aunque no llegue el aviso.
    if (forzar) setModo('android');
    window.addEventListener('beforeinstallprompt', alPoderInstalar);
    window.addEventListener('appinstalled', () => setModo('oculto'));
    return () => window.removeEventListener('beforeinstallprompt', alPoderInstalar);
  }, [forzar]);

  if (modo === 'oculto') return null;

  function descartar() {
    try {
      localStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      /* nada */
    }
    setModo('oculto');
  }

  return (
    <section className="grid gap-3 rounded-xl border border-rule bg-cream p-4 text-sm text-ink-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-ink text-cream">
          <Icono nombre="tarjeta" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold text-ink">Ten tu tarjeta a un toque</b>
          {modo === 'android' ? (
            evento ? (
              <p>Agrégala a tu pantalla de inicio y ábrela como una app, sin buscar la página.</p>
            ) : (
              <p>
                En Chrome toca el menú <b className="font-semibold text-ink">⋮</b> y luego{' '}
                <b className="font-semibold text-ink">Agregar a la pantalla de inicio</b>. Tu
                tarjeta quedará como una app.
              </p>
            )
          ) : (
            <p>
              En Safari toca <b className="font-semibold text-ink">Compartir</b>{' '}
              <span aria-hidden="true">⎋</span> y luego{' '}
              <b className="font-semibold text-ink">Agregar a inicio</b>. Tu tarjeta quedará como
              una app en tu iPhone.
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {modo === 'android' && evento && (
          <button
            type="button"
            onClick={async () => {
              await evento.prompt();
              setModo('oculto');
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-ink px-5 font-semibold text-cream"
          >
            Agregar a inicio
          </button>
        )}
        <button
          type="button"
          onClick={descartar}
          className="min-h-[44px] text-xs text-muted underline underline-offset-4"
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}
