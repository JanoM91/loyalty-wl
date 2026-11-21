'use client';

import { useState } from 'react';

import { Icono } from '@/components/lealtad/Iconos';
import { subirFotoTicket } from './acciones';
import { reducirFoto } from './foto';

/**
 * Foto de la tarjeta física que se migra. Obligatoria a partir de cierto
 * número de estampas; opcional (pero bienvenida) por debajo.
 */
export function FotoTarjetaFisica({
  sucursalSlug,
  obligatoria,
  onCambio,
}: {
  sucursalSlug: string;
  obligatoria: boolean;
  onCambio: (url: string | null) => void;
}) {
  const [estado, setEstado] = useState<{
    vista: string | null;
    subiendo: boolean;
    error: string | null;
    url: string | null;
  }>({ vista: null, subiendo: false, error: null, url: null });

  async function tomar(archivo: File | undefined) {
    if (!archivo) return;
    setEstado({ vista: null, subiendo: true, error: null, url: null });
    onCambio(null);
    try {
      const reducida = await reducirFoto(archivo);
      const vista = URL.createObjectURL(reducida);
      const form = new FormData();
      form.set('sucursal', sucursalSlug);
      form.set('tipo', 'tarjeta-fisica');
      form.set('foto', new File([reducida], 'tarjeta.jpg', { type: 'image/jpeg' }));
      const r = await subirFotoTicket(form);
      if (!r.ok) {
        setEstado({ vista, subiendo: false, error: r.error, url: null });
        return;
      }
      setEstado({ vista, subiendo: false, error: null, url: r.url });
      onCambio(r.url);
    } catch {
      setEstado({ vista: null, subiendo: false, error: 'No se pudo leer la foto.', url: null });
    }
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold text-ink">
        Foto de la tarjeta física{' '}
        <span className="font-normal text-muted">
          {obligatoria ? '(obligatoria a partir de 5 sellos)' : '(opcional)'}
        </span>
      </span>
      <label
        className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-lg border-[1.5px] border-dashed px-4 py-3 text-sm ${estado.url ? 'border-disponible bg-disponible/5' : obligatoria ? 'border-agotado bg-cream' : 'border-rule bg-cream'}`}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => tomar(e.target.files?.[0])}
        />
        {estado.vista ? (
          <img src={estado.vista} alt="Tarjeta física" className="h-14 w-14 rounded object-cover" />
        ) : (
          <Icono nombre="camara" className="text-crust" />
        )}
        <span className="min-w-0 flex-1">
          {estado.subiendo
            ? 'Subiendo foto…'
            : estado.url
              ? 'Foto guardada. Toca para repetirla.'
              : 'Toca para fotografiar la tarjeta con sus sellos.'}
        </span>
      </label>
      {estado.error && <p className="text-sm text-danger">{estado.error}</p>}
    </div>
  );
}
