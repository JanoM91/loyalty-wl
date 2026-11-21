'use client';

import { useActionState, useState } from 'react';
import { COMBINACIONES } from '@wl/domain';

import { crear, type EstadoFormulario } from '../acciones';

const CAMPO =
  'min-h-[48px] w-full border border-rule bg-cream px-3.5 text-[15px] text-ink placeholder:text-muted';

function Campo({
  nombre,
  etiqueta,
  nota,
  ...resto
}: {
  nombre: string;
  etiqueta: string;
  nota?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid content-start gap-1.5 text-[14px] text-muted">
      {etiqueta}
      <input name={nombre} className={CAMPO} {...resto} />
      {nota ? <span className="text-[13px]">{nota}</span> : null}
    </label>
  );
}

/** "Tacos El Güero" → "tacos-el-guero" (la acción lo vuelve a calcular y validar). */
const aSlug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export function FormularioNuevo() {
  const [estado, accion, enviando] = useActionState<EstadoFormulario, FormData>(crear, {
    error: null,
  });
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState<string | null>(null);
  const [combinacion, setCombinacion] = useState(COMBINACIONES[0]!.id);
  const direccion = slug ?? aSlug(nombre);
  const iniciales = nombre
    .normalize('NFD')
    .replace(/[^A-Za-z ]/g, '')
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
    .slice(0, 3);

  return (
    <form action={accion} className="grid max-w-3xl gap-10">
      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Negocio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid content-start gap-1.5 text-[14px] text-muted">
            Nombre
            <input
              name="nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={CAMPO}
            />
          </label>
          <label className="grid content-start gap-1.5 text-[14px] text-muted">
            Dirección en el sitio
            <input
              name="slug"
              required
              value={direccion}
              onChange={(e) => setSlug(e.target.value)}
              className={`${CAMPO} font-mono`}
            />
            <span className="text-[13px]">Queda en /{direccion || 'tu-negocio'}</span>
          </label>
          <Campo nombre="frase" etiqueta="Frase" nota="Una línea bajo el nombre. Opcional." />
          <Campo
            key={iniciales}
            nombre="prefijo"
            etiqueta="Prefijo del código de tarjeta"
            defaultValue={iniciales.length >= 2 ? iniciales : ''}
            required
            maxLength={4}
            nota="De 2 a 4 letras. Los códigos se ven como TG-XXXX-XXXX."
          />
          <label className="grid content-start gap-1.5 text-[14px] text-muted">
            Modalidad
            <select name="plan" className={CAMPO} defaultValue="LITE">
              <option value="LITE">Lite</option>
              <option value="PRIVADA">Privada</option>
            </select>
          </label>
          <label className="grid content-start gap-1.5 text-[14px] text-muted">
            Zona horaria
            <select name="zona" className={CAMPO} defaultValue="America/Mexico_City">
              <option value="America/Mexico_City">Centro (Ciudad de México, Xalapa)</option>
              <option value="America/Cancun">Quintana Roo</option>
              <option value="America/Chihuahua">Chihuahua</option>
              <option value="America/Hermosillo">Sonora</option>
              <option value="America/Mazatlan">Pacífico (Sinaloa, BCS)</option>
              <option value="America/Tijuana">Baja California</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Colores de arranque</h2>
        <input type="hidden" name="combinacion" value={combinacion} />
        <div className="flex flex-wrap gap-2">
          {COMBINACIONES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={combinacion === c.id}
              onClick={() => setCombinacion(c.id)}
              className={`flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 text-[14px] text-ink ${combinacion === c.id ? 'border-ink' : 'border-rule hover:border-ink'}`}
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
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Programa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            nombre="posiciones"
            etiqueta="Sellos para completar la tarjeta"
            type="number"
            min={2}
            max={30}
            defaultValue={8}
            required
          />
          <Campo
            nombre="premio"
            etiqueta="Premio al completarla"
            placeholder="Corte gratis"
            required
          />
          <Campo
            nombre="premioIncluye"
            etiqueta="Qué incluye ese premio"
            placeholder="Un corte clásico."
            nota="Opcional."
          />
          <span />
          <Campo
            nombre="premioIntermedio"
            etiqueta="Premio intermedio"
            placeholder="Café del día"
            nota="Opcional."
          />
          <Campo
            nombre="posicionIntermedio"
            etiqueta="En qué sello se gana"
            type="number"
            min={1}
            max={29}
            defaultValue={4}
          />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Sucursales</h2>
        <label className="grid gap-1.5 text-[14px] text-muted">
          Una por renglón
          <textarea
            name="sucursales"
            required
            rows={3}
            defaultValue="Matriz"
            className={`${CAMPO} py-3`}
          />
        </label>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Dueño</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nombre="duenioNombre" etiqueta="Nombre" />
          <Campo
            nombre="duenioEmail"
            etiqueta="Correo"
            type="email"
            required
            nota="Con él entra a su panel. Al crear el negocio verás el enlace para mandárselo."
          />
        </div>
      </section>

      <div className="grid gap-3">
        {estado.error && (
          <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
            {estado.error}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="min-h-[52px] justify-self-start rounded-full bg-ink px-8 text-[16px] font-semibold text-cream disabled:opacity-50"
        >
          {enviando ? 'Creando…' : 'Crear negocio'}
        </button>
      </div>
    </form>
  );
}
