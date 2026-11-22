'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] Error en segmento:', error);
  }, [error]);

  return (
    <div className="mx-auto grid max-w-md gap-4 rounded-lg border border-rule bg-cream p-6 text-center text-ink">
      <h1 className="font-display text-2xl">No pudimos cargar el panel</h1>
      <p className="text-sm text-ink-soft">
        Hubo un problema temporal al consultar los datos de tu negocio. Intenta de nuevo en unos
        segundos.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:opacity-90"
        >
          Reintentar
        </button>
        <a
          href="/admin"
          className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition hover:bg-crumb"
        >
          Volver al panel
        </a>
      </div>
    </div>
  );
}
