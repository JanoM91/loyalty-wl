'use client';

import { useActionState, useState } from 'react';

import { recargarAlTerminar } from '@/lib/recargar-al-terminar';

import { anularPago, borrar, pago, reinvitar, type EstadoFicha } from './acciones';

const CAMPO = 'min-h-[44px] border border-rule bg-cream px-3.5 text-[15px] text-ink';
const INICIAL: EstadoFicha = { error: null, listo: null };

// Pago y anulación cambian datos de la ficha: carga completa al terminar.
const pagoYRecargar = recargarAlTerminar(pago, (e) => e.recargar);
const anularYRecargar = recargarAlTerminar(anularPago, (e) => e.recargar);

/** Lo que pasó con el formulario, ahí mismo (y el enlace de un solo uso, si hay). */
function Resultado({ estado }: { estado: EstadoFicha }) {
  const [copiado, setCopiado] = useState(false);
  if (estado.error) {
    return (
      <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
        {estado.error}
      </p>
    );
  }
  if (!estado.listo) return null;
  return (
    <div role="status" className="grid gap-2 rounded-[14px] bg-ink p-4 text-cream">
      <p className="text-[15px]">{estado.listo}</p>
      {estado.enlace && (
        <>
          <code className="rounded-md bg-cream/10 px-3 py-2 text-[13px] break-all">
            {estado.enlace}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(estado.enlace!).then(() => setCopiado(true));
            }}
            className="min-h-[40px] justify-self-start rounded-full bg-[#C6FF3D] px-4 text-[14px] font-semibold text-[#120A2A]"
          >
            {copiado ? 'Copiado' : 'Copiar enlace'}
          </button>
          <p className="text-[13px] text-cream/75">
            No se vuelve a mostrar.{' '}
            <a
              href={typeof window === 'undefined' ? '#' : window.location.pathname}
              className="underline underline-offset-4"
            >
              Listo
            </a>
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Registrar un pago de Lite o del Arcade: periodo, lo cobrado y una nota. El
 * importe se llena con el precio vigente del periodo y se puede cambiar
 * (descuento, o 0 si fue cortesía).
 */
export function FormularioPago({
  slug,
  concepto,
  precios,
}: {
  slug: string;
  concepto: 'LITE' | 'ARCADE';
  /** Precio vigente en pesos; null si no está fijado. */
  precios: { readonly mes: number | null; readonly anio: number | null };
}) {
  const [estado, accion, enviando] = useActionState(pagoYRecargar, INICIAL);
  const [periodo, setPeriodo] = useState<'MES' | 'ANIO'>('MES');
  const precio = periodo === 'MES' ? precios.mes : precios.anio;
  const [importe, setImporte] = useState(precio === null ? '' : String(precio));
  const [tocado, setTocado] = useState(false);

  const elegir = (p: 'MES' | 'ANIO') => {
    setPeriodo(p);
    // Mientras no lo hayan escrito a mano, sigue al precio del periodo.
    if (!tocado) {
      const nuevo = p === 'MES' ? precios.mes : precios.anio;
      setImporte(nuevo === null ? '' : String(nuevo));
    }
  };

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="concepto" value={concepto} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1.5 text-[14px] text-muted">Periodo</legend>
        {(['MES', 'ANIO'] as const).map((p) => (
          <label
            key={p}
            className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 text-[15px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${periodo === p ? 'border-ink bg-ink text-cream' : 'border-rule text-ink'}`}
          >
            <input
              type="radio"
              name="periodo"
              value={p}
              checked={periodo === p}
              onChange={() => elegir(p)}
              className="sr-only"
            />
            {p === 'MES' ? 'Un mes' : 'Un año'}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-[14px] text-muted">
          Cobrado, con IVA
          <span className="flex items-center gap-1.5">
            <span className="text-[16px] text-ink">$</span>
            <input
              name="importe"
              inputMode="decimal"
              required
              autoComplete="off"
              value={importe}
              onChange={(e) => {
                setTocado(true);
                setImporte(e.target.value);
              }}
              placeholder={precio === null ? 'Sin precio' : String(precio)}
              className={`${CAMPO} w-32`}
            />
          </span>
        </label>
        <label className="grid min-w-[12rem] flex-1 gap-1.5 text-[14px] text-muted">
          Nota (opcional)
          <input
            name="nota"
            maxLength={250}
            autoComplete="off"
            placeholder="Transferencia, descuento, cortesía…"
            className={CAMPO}
          />
        </label>
        <button
          type="submit"
          disabled={enviando || Boolean(estado.recargar)}
          className="min-h-[44px] rounded-full bg-ink px-5 text-[15px] font-semibold text-cream disabled:opacity-50"
        >
          {enviando || estado.recargar ? 'Registrando…' : 'Registrar pago'}
        </button>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}

/** «Anular este pago», con su confirmación dentro de un desplegable. */
export function AnularPago({
  pagoId,
  antes,
  desde,
}: {
  pagoId: string;
  antes: string;
  /** A qué página volver al terminar. */
  desde: 'ingresos' | 'ficha';
}) {
  const [estado, accion, enviando] = useActionState(anularYRecargar, INICIAL);
  if (estado.listo) return <Resultado estado={estado} />;
  return (
    <details>
      <summary className="min-h-[36px] cursor-pointer py-1 text-[13px] text-[#5A4F63] underline underline-offset-4">
        Anular este pago
      </summary>
      <form action={accion} className="mt-2 flex flex-wrap items-center gap-3">
        <input type="hidden" name="pago" value={pagoId} />
        <input type="hidden" name="desde" value={desde} />
        <span className="max-w-prose text-[13px] text-ink">
          Si es el último pago, la fecha de pago regresa {antes}.
        </span>
        <button
          type="submit"
          disabled={enviando}
          className="min-h-[40px] rounded-full bg-[#8C231B] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
        >
          {enviando ? 'Anulando…' : 'Sí, anular'}
        </button>
      </form>
      <Resultado estado={estado} />
    </details>
  );
}

/** Enlace nuevo para el dueño: se muestra aquí mismo una sola vez. */
export function InvitarDuenio({ slug }: { slug: string }) {
  const [estado, accion, enviando] = useActionState(reinvitar, INICIAL);
  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-[14px] text-muted">
          Correo
          <input name="email" type="email" required autoComplete="off" className={CAMPO} />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="min-h-[44px] rounded-full border border-rule px-5 text-[15px] text-ink hover:border-ink disabled:opacity-50"
        >
          {enviando ? 'Generando…' : 'Generar enlace'}
        </button>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}

/** Borrar un club: hay que escribir su dirección para confirmar. */
export function BorrarClub({ slug }: { slug: string }) {
  const [estado, accion, enviando] = useActionState(borrar, INICIAL);
  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-[14px] text-muted">
          Para confirmar, escribe «{slug}»
          <input name="confirmacion" required autoComplete="off" className={CAMPO} />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="min-h-[44px] rounded-full bg-agotado px-5 text-[15px] font-semibold text-cream disabled:opacity-50"
        >
          {enviando ? 'Borrando…' : 'Borrar para siempre'}
        </button>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}
