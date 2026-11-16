import type { ReactNode } from 'react';

import { Icono, type NombreIcono } from './Iconos';

type Tono = 'ok' | 'atencion' | 'error' | 'info' | 'neutro';

const ESTILOS: Record<Tono, { caja: string; acento: string; icono: NombreIcono }> = {
  ok: { caja: 'bg-disponible/10', acento: 'text-disponible', icono: 'palomita' },
  atencion: { caja: 'bg-agotado/10', acento: 'text-agotado', icono: 'alerta' },
  error: { caja: 'bg-danger/10', acento: 'text-danger', icono: 'cruz' },
  info: { caja: 'bg-vuelve/10', acento: 'text-vuelve', icono: 'info' },
  neutro: { caja: 'bg-crumb', acento: 'text-ink', icono: 'info' },
};

/** Aviso con título y explicación. El color nunca va solo: lleva ícono y texto. */
export function Aviso({
  tono,
  titulo,
  icono,
  children,
}: {
  tono: Tono;
  titulo?: string;
  icono?: NombreIcono;
  children?: ReactNode;
}) {
  const e = ESTILOS[tono];
  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={`grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 rounded-md px-3.5 py-3 text-sm leading-snug text-ink-soft ${e.caja}`}
    >
      <Icono nombre={icono ?? e.icono} className={`mt-px ${e.acento}`} />
      <div>
        {titulo && <p className={`font-semibold ${e.acento}`}>{titulo}</p>}
        {children}
      </div>
    </div>
  );
}
