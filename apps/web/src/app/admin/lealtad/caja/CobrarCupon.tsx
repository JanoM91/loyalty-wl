'use client';

import { useState, useTransition } from 'react';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono } from '@/components/lealtad/Iconos';

import { buscarCupon, cobrarCupon, type CuponParaCaja } from './cupones';

const CAMPO =
  'min-h-[52px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 font-mono text-lg tracking-[0.12em] text-ink uppercase focus:border-ink focus:outline-none';

const fecha = (d: Date) =>
  new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Cobrar una promoción de «Juega y gana»: el cliente enseña el código en su
 * celular, la caja lo escribe, revisa qué es y lo cobra una sola vez.
 */
export function CobrarCupon({
  sucursal,
  prefijo,
  onTerminar,
}: {
  sucursal: { readonly slug: string; readonly nombre: string };
  prefijo: string;
  onTerminar: () => void;
}) {
  const [texto, setTexto] = useState(`${prefijo}-`);
  const [cupon, setCupon] = useState<CuponParaCaja | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cobrado, setCobrado] = useState(false);
  const [ocupado, iniciar] = useTransition();

  const buscar = () =>
    iniciar(async () => {
      setError(null);
      setCupon(null);
      const r = await buscarCupon(texto, sucursal.slug);
      if (r.ok) setCupon(r.cupon);
      else setError(r.error);
    });

  const cobrar = () =>
    iniciar(async () => {
      if (!cupon) return;
      setError(null);
      const r = await cobrarCupon(cupon.codigo, sucursal.slug);
      if (r.ok) setCobrado(true);
      else setError(r.error);
    });

  const volver = (
    <button
      type="button"
      onClick={onTerminar}
      className="inline-flex min-h-[40px] items-center gap-1 justify-self-start text-sm text-crust-dark underline underline-offset-4"
    >
      <Icono nombre="izquierda" width={16} height={16} />
      Volver a la caja
    </button>
  );

  if (cobrado && cupon) {
    return (
      <div className="grid gap-4">
        <Aviso tono="ok" titulo="Promoción cobrada">
          Entrega «{cupon.titulo}» {cupon.cliente ? `a ${cupon.cliente} ` : ''}con su compra.
        </Aviso>
        <button
          type="button"
          onClick={onTerminar}
          className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-ink px-6 font-semibold text-cream"
        >
          Listo
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {volver}
      <div className="grid gap-1">
        <h2 className="text-2xl text-ink">Cobrar promoción del juego</h2>
        <p className="text-sm text-muted">
          Pide al cliente que abra «Juega y gana» en su tarjeta y escribe el código que le aparece.
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          buscar();
        }}
      >
        <label className="grid gap-1.5 text-sm text-muted">
          Código de la promoción
          <input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value.toUpperCase());
              setCupon(null);
            }}
            className={CAMPO}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={14}
            placeholder={`${prefijo}-XXXX`}
          />
        </label>
        <button
          type="submit"
          disabled={ocupado}
          className="inline-flex min-h-[52px] items-center justify-center self-end rounded-sm border-[1.5px] border-ink px-6 font-semibold text-ink disabled:opacity-40"
        >
          Buscar
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="border-l-[3px] border-agotado bg-agotado/5 px-4 py-3 text-sm text-ink"
        >
          {error}
        </p>
      )}

      {cupon && (
        <section className="grid gap-3 rounded-lg border border-rule bg-cream p-4">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted">
              {cupon.cliente ?? 'Cliente sin nombre'} · tarjeta {cupon.tarjeta}
            </span>
            <b className="font-display text-xl leading-tight text-ink">{cupon.titulo}</b>
            <span className="font-mono text-sm text-ink-soft">{cupon.codigo}</span>
          </div>
          {cupon.estado === 'DISPONIBLE' ? (
            <>
              <p className="text-sm text-ink-soft">Vence el {fecha(cupon.vence)}.</p>
              {!cupon.verificada && (
                <Aviso tono="atencion" titulo="El cliente debe verificar su contacto">
                  Pide que verifique su correo desde su tarjeta, o mándale su enlace por WhatsApp
                  desde «Cliente sin tarjeta a la mano». La promoción se conserva.
                </Aviso>
              )}
              <button
                type="button"
                onClick={cobrar}
                disabled={ocupado || !cupon.verificada}
                className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-ink px-6 font-semibold text-cream disabled:opacity-40"
              >
                Cobrar y entregar
              </button>
            </>
          ) : cupon.estado === 'CANJEADO' ? (
            <Aviso tono="error" titulo="Ya se cobró">
              {cupon.canjeado
                ? `Se cobró el ${fecha(cupon.canjeado)}.`
                : 'Esta promoción ya se usó.'}
            </Aviso>
          ) : (
            <Aviso tono="error" titulo="Ya venció">
              Venció el {fecha(cupon.vence)}.
            </Aviso>
          )}
        </section>
      )}
    </div>
  );
}
