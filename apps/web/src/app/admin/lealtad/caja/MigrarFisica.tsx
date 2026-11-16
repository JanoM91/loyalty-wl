'use client';

import { useState, useTransition } from 'react';
import type { VistaCaja } from '@wl/database';
import type { ProgramaLealtad } from '@wl/domain';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono } from '@/components/lealtad/Iconos';
import { FotoTarjetaFisica } from './FotoTarjetaFisica';
import { migrarFisicaExistente } from './nuevo-cliente';

const CAMPO =
  'min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-base focus:border-ink focus:outline-none';

/**
 * Pasar las visitas de la tarjeta física a una tarjeta digital existente.
 * Se hace una sola vez por cliente; después, la opción desaparece.
 */
export function MigrarFisica({
  tarjeta,
  sucursalSlug,
  programa,
  onListo,
}: {
  tarjeta: VistaCaja;
  sucursalSlug: string;
  programa: ProgramaLealtad;
  onListo: (t: VistaCaja) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [visitas, setVisitas] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  if (tarjeta.migradaFisica) return null;

  const n = Number(visitas || '0');
  const tope = Math.max(0, programa.posiciones - 2 - tarjeta.estampas);
  const pideEvidencia = n > 0 && n + tarjeta.estampas + 1 >= 5;
  const faltaContacto = pideEvidencia && !(tarjeta.tieneCorreo && tarjeta.tieneCelular);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm text-crust-dark underline underline-offset-4"
      >
        <Icono nombre="tarjeta" width={16} height={16} /> ¿Trae tarjeta física? Pasar sus visitas
      </button>
    );
  }

  return (
    <section className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
      <h3 className="text-base font-semibold text-ink">Tarjeta física → digital</h3>
      <p className="text-sm text-ink-soft">
        Se hace una sola vez. Con la visita de hoy, la tarjeta no puede pasar de{' '}
        {programa.posiciones - 1} estampas: máximo {tope} {tope === 1 ? 'visita' : 'visitas'}.
      </p>
      <label className="grid gap-1.5 text-sm font-semibold text-ink">
        Visitas selladas en la tarjeta física
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={tope}
          value={visitas}
          onChange={(e) => setVisitas(e.target.value)}
          className={`${CAMPO} font-mono`}
        />
      </label>
      <FotoTarjetaFisica
        sucursalSlug={sucursalSlug}
        obligatoria={pideEvidencia}
        onCambio={setFoto}
      />
      {faltaContacto && (
        <Aviso tono="atencion" titulo="Falta un contacto">
          A partir de 5 estampas la tarjeta debe tener celular y correo. Pide al cliente que agregue
          el que falta desde su perfil, o captura menos visitas por ahora.
        </Aviso>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado || n < 1 || n > tope || faltaContacto || (pideEvidencia && !foto)}
          onClick={() =>
            iniciar(async () => {
              setError(null);
              const r = await migrarFisicaExistente({
                codigo: tarjeta.codigo,
                sucursalSlug,
                visitas,
                fotoTarjetaUrl: foto,
              });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              onListo(r.tarjeta);
              setAbierto(false);
            })
          }
          className="inline-flex min-h-[48px] items-center justify-center rounded-sm bg-ink px-5 font-semibold text-cream disabled:opacity-40"
        >
          {ocupado ? 'Pasando visitas…' : `Pasar ${n || ''} ${n === 1 ? 'visita' : 'visitas'}`}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-[48px] px-3 text-sm text-crust-dark underline underline-offset-4"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}
