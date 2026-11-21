'use client';

import { useEffect, useState } from 'react';

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Plataforma = 'ios' | 'android' | 'otra';

/**
 * Tarjeta «Ten tu panel como app». Se esconde si el panel ya está abierto
 * como app instalada. En Android con Chrome usa el aviso de instalación del
 * navegador; en iPhone explica los dos toques de Safari, que no tiene botón.
 */
export function InstalarPanel() {
  const [visible, setVisible] = useState(false);
  const [plataforma, setPlataforma] = useState<Plataforma>('otra');
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    const comoApp =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (comoApp) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
    setPlataforma(ios ? 'ios' : /Android/.test(ua) ? 'android' : 'otra');
    setVisible(true);

    const alPedir = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const alInstalar = () => setInstalada(true);
    window.addEventListener('beforeinstallprompt', alPedir);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPedir);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (!visible) return null;

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'accepted') setInstalada(true);
    setEvento(null);
  }

  return (
    <section
      aria-labelledby="instalar-panel"
      className="flex items-start gap-3 rounded-[22px] border-[1.5px] border-[#CDE8DC] bg-white p-4 shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]"
    >
      <span
        aria-hidden="true"
        className="grid size-[46px] flex-none place-items-center rounded-[14px] bg-[#06231C]"
      >
        <span className="size-[18px] rounded-full bg-[#00C389]" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="instalar-panel" className="text-[15px] font-bold text-ink">
          {instalada ? 'Listo: ya está en tu pantalla de inicio' : 'Ten tu panel como app'}
        </h2>
        {instalada ? (
          <p className="mt-0.5 text-[13px] text-[#3C5A51]">
            Ábrelo desde el ícono «Mi panel». La primera vez te pide tu contraseña.
          </p>
        ) : plataforma === 'ios' ? (
          <p className="mt-0.5 text-[13px] text-[#3C5A51]">
            En Safari toca <b className="text-ink">Compartir</b> (el cuadro con la flecha) y luego{' '}
            <b className="text-ink">Agregar a pantalla de inicio</b>. La primera vez que lo abras te
            pide tu contraseña.
          </p>
        ) : evento ? (
          <>
            <p className="mt-0.5 text-[13px] text-[#3C5A51]">
              Un toque y queda junto a tus apps, para cobrar más rápido.
            </p>
            <button
              type="button"
              onClick={instalar}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-sm font-semibold text-cream"
            >
              Instalar «Mi panel»
            </button>
          </>
        ) : plataforma === 'android' ? (
          <p className="mt-0.5 text-[13px] text-[#3C5A51]">
            En Chrome toca el menú <b className="text-ink">⋮</b> y luego{' '}
            <b className="text-ink">Instalar app</b> o{' '}
            <b className="text-ink">Agregar a la pantalla principal</b>.
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] text-[#3C5A51]">
            Ábrelo desde tu celular y agrégalo a la pantalla de inicio: queda junto a tus apps, para
            cobrar más rápido.
          </p>
        )}
      </div>
    </section>
  );
}
