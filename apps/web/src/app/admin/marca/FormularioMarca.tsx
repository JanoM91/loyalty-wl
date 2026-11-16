'use client';

import { useActionState, useState, type CSSProperties } from 'react';
import type { MarcaNegocio, PlantillaMarca } from '@wl/database';
import type { ProgramaLealtad } from '@wl/domain';

import { ProveedorMarca } from '@/components/Marca';
import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';

import { guardarMarca, type EstadoMarca } from './acciones';

type Colores = MarcaNegocio['colores'];

const PLANTILLAS: readonly { id: PlantillaMarca; nombre: string; nota: string }[] = [
  { id: 'aire', nombre: 'Aire', nota: 'Clara y mínima' },
  { id: 'noche', nombre: 'Noche', nota: 'Para fondos oscuros' },
  { id: 'calida', nombre: 'Cálida', nota: 'Serif, artesanal' },
];

/** Combinaciones ya revisadas: un toque y la tarjeta cambia. */
const COMBINACIONES: readonly { nombre: string; plantilla: PlantillaMarca; colores: Colores }[] = [
  {
    nombre: 'Grafito',
    plantilla: 'aire',
    colores: {
      fondo: '#1d1d1f',
      sobreFondo: '#ffffff',
      acento: '#ffd60a',
      papel: '#f5f5f7',
      tinta: '#1d1d1f',
    },
  },
  {
    nombre: 'Cobalto',
    plantilla: 'aire',
    colores: {
      fondo: '#1f3fff',
      sobreFondo: '#ffffff',
      acento: '#c8ff3d',
      papel: '#f3f5fb',
      tinta: '#0b1437',
    },
  },
  {
    nombre: 'Mandarina',
    plantilla: 'aire',
    colores: {
      fondo: '#ff5a1f',
      sobreFondo: '#1c0b02',
      acento: '#fff1d6',
      papel: '#fff8f1',
      tinta: '#2a1206',
    },
  },
  {
    nombre: 'Salvia',
    plantilla: 'aire',
    colores: {
      fondo: '#dfe8d8',
      sobreFondo: '#16271b',
      acento: '#16271b',
      papel: '#f7f8f4',
      tinta: '#16271b',
    },
  },
  {
    nombre: 'Medianoche',
    plantilla: 'noche',
    colores: {
      fondo: '#f2f2ee',
      sobreFondo: '#0c0c0d',
      acento: '#6d4aff',
      papel: '#0c0c0d',
      tinta: '#f2f2ee',
    },
  },
  {
    nombre: 'Horno',
    plantilla: 'calida',
    colores: {
      fondo: '#3b2417',
      sobreFondo: '#fbf3e6',
      acento: '#e9b872',
      papel: '#f6eee1',
      tinta: '#2b1a10',
    },
  },
];

const COLORES: readonly { id: keyof Colores; nombre: string; nota: string }[] = [
  { id: 'fondo', nombre: 'Tarjeta', nota: 'Fondo de la tarjeta y de los botones' },
  { id: 'sobreFondo', nombre: 'Texto de la tarjeta', nota: 'Lo que se lee sobre ese fondo' },
  { id: 'acento', nombre: 'Sellos', nota: 'Estampas ganadas y premios' },
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
          <h2 className="text-xl text-ink">Diseño</h2>
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

          <p className="mt-2 text-[14px] text-muted">Empieza con una combinación y ajústala.</p>
          <div className="flex flex-wrap gap-2">
            {COMBINACIONES.map((c) => (
              <button
                key={c.nombre}
                type="button"
                onClick={() => {
                  setColores(c.colores);
                  setPlantilla(c.plantilla);
                }}
                className="flex items-center gap-2 rounded-full border border-rule py-1.5 pr-3.5 pl-1.5 text-[14px] text-ink hover:border-ink"
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

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl text-ink">Contacto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              nombre="correo"
              etiqueta="Correo"
              valor={marca.contacto.correo ?? ''}
              tipo="email"
            />
            <Campo
              nombre="whatsapp"
              etiqueta="WhatsApp"
              valor={marca.contacto.whatsapp?.replace(/^52/, '') ?? ''}
              nota="Diez dígitos."
              tipo="tel"
            />
            <Campo
              nombre="sitio"
              etiqueta="Sitio web"
              valor={marca.contacto.sitio ?? ''}
              nota="Empieza por https://"
            />
            <Campo nombre="instagram" etiqueta="Instagram" valor={marca.redes.instagram ?? ''} />
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl text-ink">Datos para términos y privacidad</h2>
          <p className="-mt-2 max-w-prose text-[14px] text-muted">
            Aparecen en los términos del programa y en el aviso de privacidad. Son plantillas:
            revísalas con tu abogado antes de abrir el programa al público.
          </p>
          <Campo
            nombre="razonSocial"
            etiqueta="Razón social"
            valor={marca.legal.razonSocial ?? ''}
          />
          <Campo nombre="domicilio" etiqueta="Domicilio" valor={marca.legal.domicilio ?? ''} />
          <Campo
            nombre="correoPrivacidad"
            etiqueta="Correo para aclaraciones y datos personales"
            valor={marca.legal.correoPrivacidad ?? ''}
            tipo="email"
          />
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
              Marca guardada.{' '}
              {estado.avisos.length > 0 ? estado.avisos.join(' ') : 'Ya la ven tus clientes.'}
            </p>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="min-h-[52px] justify-self-start rounded-full bg-ink px-8 text-[16px] font-semibold text-cream disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar marca'}
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
