'use client';

import { useActionState, useState, type CSSProperties } from 'react';
import type { MarcaNegocio, PlantillaMarca } from '@wl/database';
import { COMBINACIONES, type ProgramaLealtad } from '@wl/domain';

import { ProveedorMarca } from '@/components/Marca';
import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';

import { guardarMarca, type EstadoMarca } from './acciones';

type Colores = MarcaNegocio['colores'];

const PLANTILLAS: readonly { id: PlantillaMarca; nombre: string; nota: string }[] = [
  { id: 'aire', nombre: 'Aire', nota: 'Clara y mínima' },
  { id: 'noche', nombre: 'Noche', nota: 'Para fondos oscuros' },
  { id: 'calida', nombre: 'Cálida', nota: 'Serif, artesanal' },
];

const COLORES: readonly { id: keyof Colores; nombre: string; nota: string }[] = [
  { id: 'fondo', nombre: 'Tarjeta', nota: 'Fondo de la tarjeta y de los botones' },
  { id: 'sobreFondo', nombre: 'Texto de la tarjeta', nota: 'Lo que se lee sobre ese fondo' },
  { id: 'acento', nombre: 'Sellos', nota: 'Sellos ganados y premios' },
  { id: 'papel', nombre: 'Página', nota: 'Fondo de la pantalla' },
  { id: 'tinta', nombre: 'Texto', nota: 'Lo que se lee sobre la página' },
];

const CAMPO =
  'min-h-[48px] w-full border border-rule bg-cream px-3.5 text-[15px] text-ink placeholder:text-muted';

function Campo({
  nombre,
  etiqueta,
  valor,
  nota,
  tipo = 'text',
}: {
  nombre: string;
  etiqueta: string;
  valor: string;
  nota?: string;
  tipo?: string;
}) {
  return (
    <label className="grid gap-1.5 text-[14px] text-muted">
      {etiqueta}
      <input name={nombre} type={tipo} defaultValue={valor} className={CAMPO} />
      {nota ? <span className="text-[13px]">{nota}</span> : null}
    </label>
  );
}

export function FormularioMarca({
  nombre: nombreInicial,
  marca,
  programa,
}: {
  nombre: string;
  marca: MarcaNegocio;
  programa: ProgramaLealtad;
}) {
  const [estado, accion, guardando] = useActionState<EstadoMarca, FormData>(guardarMarca, {
    ok: false,
    error: null,
    avisos: [],
  });
  const [nombre, setNombre] = useState(nombreInicial);
  const [plantilla, setPlantilla] = useState<PlantillaMarca>(marca.plantilla);
  const [colores, setColores] = useState<Colores>(marca.colores);

  const primerPremio = Math.min(...programa.hitos.map((h) => h.posicion));
  const vista = {
    '--wl-fondo': colores.fondo,
    '--wl-sobre': colores.sobreFondo,
    '--wl-acento': colores.acento,
    '--wl-papel': colores.papel,
    '--wl-tinta': colores.tinta,
  } as CSSProperties;

  return (
    <form action={accion} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="grid gap-10">
        <section className="grid gap-4">
          <h2 className="text-xl text-ink">Nombre y frase</h2>
          <label className="grid gap-1.5 text-[14px] text-muted">
            Nombre del negocio
            <input
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={CAMPO}
            />
          </label>
          <Campo
            nombre="frase"
            etiqueta="Frase"
            valor={marca.frase}
            nota="Una línea bajo tu nombre en la portada. Opcional."
          />
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl text-ink">Colores</h2>
          <p className="-mt-2 text-[14px] text-muted">
            Toca una combinación y mira la tarjeta. Si subiste tu logotipo, arriba puedes usar sus
            colores.
          </p>
          <div className="flex flex-wrap gap-2">
            {COMBINACIONES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setColores(c.colores);
                  setPlantilla(c.plantilla);
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-full border border-rule py-1.5 pr-3.5 pl-1.5 text-[14px] text-ink hover:border-ink"
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded-full border border-rule"
                  style={{ background: c.colores.fondo }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.colores.acento }}
                  />
                </span>
                {c.nombre}
              </button>
            ))}
          </div>

          <details className="group rounded-[16px] border border-rule bg-white px-4 py-1">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-[15px] font-semibold text-ink">
              Ajustar cada color
              <span
                aria-hidden="true"
                className="text-muted transition-transform group-open:rotate-90"
              >
                ›
              </span>
            </summary>
            <div className="grid gap-3 pt-2 pb-4 sm:grid-cols-2">
              {COLORES.map((c) => (
                <label key={c.id} className="flex items-center gap-3 text-[14px] text-muted">
                  <input
                    type="color"
                    name={c.id}
                    value={colores[c.id]}
                    onChange={(e) => setColores({ ...colores, [c.id]: e.target.value })}
                    className="h-12 w-12 flex-none cursor-pointer rounded-full border border-rule bg-transparent p-1"
                  />
                  <span>
                    <b className="block text-[15px] font-semibold text-ink">{c.nombre}</b>
                    {c.nota}
                  </span>
                </label>
              ))}
            </div>
          </details>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl text-ink">Estilo</h2>
          <input type="hidden" name="plantilla" value={plantilla} />
          <div className="flex flex-wrap gap-2">
            {PLANTILLAS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={plantilla === p.id}
                onClick={() => setPlantilla(p.id)}
                className={`grid gap-0.5 border px-4 py-3 text-left text-[15px] ${plantilla === p.id ? 'border-ink text-ink' : 'border-rule text-muted hover:text-ink'}`}
              >
                <b className="font-semibold">{p.nombre}</b>
                <span className="text-[13px]">{p.nota}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-3">
          {estado.error && (
            <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
              {estado.error}
            </p>
          )}
          {estado.ok && (
            <p
              role="status"
              className="border-l-[3px] border-disponible px-3 py-2 text-[15px] text-ink"
            >
              Listo, guardado.{' '}
              {estado.avisos.length > 0 ? estado.avisos.join(' ') : 'Ya la ven tus clientes.'}
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="min-h-[52px] justify-self-start rounded-full bg-ink px-8 text-[16px] font-semibold text-cream disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Vista previa: la tarjeta con lo que estás eligiendo, antes de guardar. */}
      <aside
        aria-label="Vista previa"
        data-plantilla={plantilla}
        style={vista}
        className="grid gap-4 rounded-xl border border-rule bg-crumb p-5 font-sans text-ink lg:sticky lg:top-6"
      >
        <ProveedorMarca
          marca={{
            nombre: nombre || 'Tu negocio',
            logoClaroUrl: marca.logoClaroUrl,
            logoUrl: marca.logoUrl,
            iconoUrl: marca.iconoUrl,
            ejemploCodigo: '',
            prefijoCodigo: '',
          }}
        >
          <p className="font-display text-[19px] font-bold">{nombre || 'Tu negocio'}</p>
          <TarjetaSellos
            datos={{ estampas: Math.max(1, primerPremio - 1), ciclo: 1, nombre: 'Vista previa' }}
            programa={programa}
            compacta
          />
          <span className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-ink px-6 text-[15px] font-semibold text-cream">
            Crear mi tarjeta
          </span>
        </ProveedorMarca>
      </aside>
    </form>
  );
}
