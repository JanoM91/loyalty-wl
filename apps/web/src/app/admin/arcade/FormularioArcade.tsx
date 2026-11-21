'use client';

import { useActionState, useState } from 'react';
import {
  ICONOS_ARCADE,
  JUEGOS,
  LIMITES_META,
  NOMBRE_LISTA,
  RETOS_POR_OMISION,
  TIPOS_RETO,
  normalizarPalabra,
  textoReto,
  type ConfigArcade,
  type IconoArcade,
  type IdJuego,
  type ModoLista,
  type PermisosArcade,
  type Reto,
  type TipoReto,
} from '@wl/domain';

import { Miniatura, type TemaSinFuente } from '@/components/lealtad/arcade/Arcade';

import { guardarArcade, type EstadoArcade } from './acciones';

const CAMPO =
  'min-h-[48px] w-full border border-rule bg-cream px-3.5 text-[15px] text-ink placeholder:text-muted';
const ETIQUETA = 'grid gap-1.5 text-[14px] text-muted';

const NOMBRE_ICONO: Record<IconoArcade, string> = {
  taza: 'Taza de café',
  concha: 'Concha',
  croissant: 'Croissant',
  grano: 'Grano de café',
  tijeras: 'Tijeras',
  navaja: 'Navaja',
  brocha: 'Brocha',
  peine: 'Peine',
  esmalte: 'Esmalte',
  gema: 'Gema',
  lima: 'Lima',
  flor: 'Flor',
  regalo: 'Regalo',
  bolsa: 'Bolsa con tu inicial',
  estrella: 'Estrella',
  corazon: 'Corazón',
};

const NOMBRE_TIPO: Record<TipoReto, string> = {
  dias: 'Días distintos jugando',
  partidas: 'Partidas jugadas',
  puntaje: 'Puntos en una sola partida',
  acumulado: 'Puntos acumulados',
  juegos: 'Juegos distintos',
  nivel: 'Nivel alcanzado',
};

const INICIAL: EstadoArcade = { ok: false, error: null };

const nuevoId = () => `reto-${Date.now().toString(36)}`;

/**
 * Configuración de «Juega y gana» para el dueño: juegos, cuántas partidas al
 * día, retos con su promoción, la lista de la semana y cómo se ve su negocio
 * en los juegos. Solo ofrece lo que su plan incluye; el servidor lo vuelve a
 * revisar al guardar.
 */
export function FormularioArcade({
  permisos,
  config,
  tema,
}: {
  permisos: PermisosArcade;
  config: ConfigArcade;
  tema: TemaSinFuente;
}) {
  const [estado, accion, guardando] = useActionState(guardarArcade, INICIAL);
  const [juegos, setJuegos] = useState<IdJuego[]>([...config.juegos]);
  const [modo, setModo] = useState(config.modo);
  const [partidasDia, setPartidasDia] = useState(config.partidasDia);
  const [retos, setRetos] = useState<Reto[]>(config.retos.map((r) => ({ ...r })));
  const [lista, setLista] = useState({ ...config.lista });
  const [productos, setProductos] = useState(config.productos.map((p) => ({ ...p })));
  const [palabras, setPalabras] = useState(config.palabras.join(', '));

  const permitidos = JUEGOS.filter((j) => j.disponible && permisos.juegos.includes(j.id));
  const lleno = juegos.length >= permisos.maxJuegosActivos;
  const listas = permisos.listas.filter((m) => m !== 'ninguna');
  const leidas = palabras
    .split(/[\s,;]+/)
    .map((w) => (w ? normalizarPalabra(w) : null))
    .filter((w): w is string => w !== null);
  const descartadas = palabras.split(/[\s,;]+/).filter((w) => w && !normalizarPalabra(w));
  const temaVista: TemaSinFuente = { ...tema, prods: productos.map((p) => p.icono) };

  const cambiaReto = (i: number, cambio: Partial<Reto>) =>
    setRetos((rs) => rs.map((r, k) => (k === i ? { ...r, ...cambio } : r)));

  const salida = {
    juegos,
    modo,
    partidasDia,
    retos: retos.slice(0, permisos.maxRetos),
    lista,
    productos: productos.filter((p) => p.nombre.trim()),
    palabras: leidas,
  };
  const faltaPromocion =
    permisos.edicionRetos !== 'ninguna' && salida.retos.some((r) => !r.premio.trim());

  return (
    <form action={accion} className="grid max-w-3xl gap-10">
      <input type="hidden" name="config" value={JSON.stringify(salida)} />

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-xl text-ink">Juegos</h2>
          <p className="text-[14px] text-muted">
            Elige hasta {permisos.maxJuegosActivos}. Llevan tus colores, tu inicial y tus productos.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {JUEGOS.map((j) => {
            const incluido = permitidos.some((p) => p.id === j.id);
            const marcado = juegos.includes(j.id);
            const nota = !j.disponible
              ? 'Próximamente'
              : !incluido
                ? 'No incluido en tu plan'
                : j.dificultad;
            return (
              <label
                key={j.id}
                className={`flex min-h-[56px] items-center gap-3 border px-3.5 py-2 text-[15px] ${marcado ? 'border-ink text-ink' : 'border-rule text-muted'} ${incluido ? 'cursor-pointer' : 'opacity-60'}`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--wl-tinta)]"
                  checked={marcado}
                  disabled={!incluido || (!marcado && lleno)}
                  onChange={(e) =>
                    setJuegos((xs) =>
                      e.target.checked ? [...xs, j.id] : xs.filter((x) => x !== j.id),
                    )
                  }
                />
                <span className="grid">
                  <b className="font-semibold text-ink">{j.nombre}</b>
                  <span className="text-[13px]">{nota}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Cuándo se juega</h2>
        <div className="grid gap-2">
          {(
            [
              ['fijos', 'Todos los juegos que elegiste, todos los días'],
              ['semana', 'Un juego por semana, y cambia cada lunes'],
            ] as const
          ).map(([id, texto]) => (
            <label key={id} className="flex items-center gap-3 text-[15px] text-ink">
              <input
                type="radio"
                name="modo-vista"
                className="h-5 w-5 accent-[var(--wl-tinta)]"
                checked={modo === id}
                onChange={() => setModo(id)}
              />
              {texto}
            </label>
          ))}
        </div>
        <label className={`${ETIQUETA} max-w-xs`}>
          Partidas por cliente al día
          <select
            className={CAMPO}
            value={partidasDia}
            onChange={(e) => setPartidasDia(Number(e.target.value))}
          >
            {Array.from({ length: permisos.maxPartidasDia }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-[13px]">
            Pocas partidas hacen que vuelvan cada día. Tu plan permite hasta{' '}
            {permisos.maxPartidasDia}.
          </span>
        </label>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-xl text-ink">Retos y promociones</h2>
          <p className="max-w-prose text-[14px] text-muted">
            Cada reto da una promoción una vez por semana o por mes. Las metas tienen un mínimo para
            que no se ganen con una partida. Las promociones se cobran en caja con un código.
          </p>
        </div>

        {permisos.edicionRetos === 'ninguna' ? (
          <ul className="grid gap-2">
            {RETOS_POR_OMISION.slice(0, permisos.maxRetos).map((r) => (
              <li key={r.id} className="border border-rule px-3.5 py-3 text-[15px] text-ink">
                <b className="block font-semibold">{textoReto(r)}</b>
                <span className="text-[14px] text-muted">Promoción: {r.premio}</span>
              </li>
            ))}
            <li className="text-[13px] text-muted">
              Tu plan usa los retos de club-lealtad. Para cambiarlos, escríbenos.
            </li>
          </ul>
        ) : (
          <div className="grid gap-3">
            {retos.slice(0, permisos.maxRetos).map((r, i) => {
              const lim = LIMITES_META[r.tipo];
              return (
                <fieldset key={r.id} className="grid gap-3 border border-rule p-4">
                  <legend className="px-1 text-[14px] font-semibold text-ink">
                    {textoReto(r)}
                  </legend>
                  {permisos.edicionRetos === 'todo' && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={ETIQUETA}>
                        Qué se mide
                        <select
                          className={CAMPO}
                          value={r.tipo}
                          onChange={(e) => {
                            const tipo = e.target.value as TipoReto;
                            const l = LIMITES_META[tipo];
                            cambiaReto(i, {
                              tipo,
                              meta: Math.min(l.max, Math.max(l.min, r.meta)),
                            });
                          }}
                        >
                          {TIPOS_RETO.map((t) => (
                            <option key={t} value={t}>
                              {NOMBRE_TIPO[t]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={ETIQUETA}>
                        Meta
                        <input
                          type="number"
                          inputMode="numeric"
                          className={CAMPO}
                          min={lim.min}
                          max={lim.max}
                          value={r.meta}
                          onChange={(e) => cambiaReto(i, { meta: Number(e.target.value) || 0 })}
                          onBlur={() =>
                            cambiaReto(i, {
                              meta: Math.min(lim.max, Math.max(lim.min, Math.round(r.meta))),
                            })
                          }
                        />
                        <span className="text-[13px]">
                          Mínimo {lim.min.toLocaleString('es-MX')}
                        </span>
                      </label>
                      <label className={ETIQUETA}>
                        Cada
                        <select
                          className={CAMPO}
                          value={r.periodo}
                          onChange={(e) =>
                            cambiaReto(i, { periodo: e.target.value === 'mes' ? 'mes' : 'semana' })
                          }
                        >
                          <option value="semana">Semana</option>
                          <option value="mes">Mes</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <label className={ETIQUETA}>
                      Promoción que gana
                      <input
                        className={CAMPO}
                        maxLength={120}
                        value={r.premio}
                        placeholder="Ej. 10% de descuento en tu siguiente visita"
                        onChange={(e) => cambiaReto(i, { premio: e.target.value })}
                      />
                    </label>
                    <label className={ETIQUETA}>
                      Días para usarla
                      <input
                        type="number"
                        inputMode="numeric"
                        className={CAMPO}
                        min={1}
                        max={60}
                        value={r.vigenciaDias}
                        onChange={(e) =>
                          cambiaReto(i, {
                            vigenciaDias: Math.min(60, Math.max(1, Number(e.target.value) || 1)),
                          })
                        }
                      />
                    </label>
                  </div>
                  {permisos.edicionRetos === 'todo' && retos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRetos((rs) => rs.filter((_, k) => k !== i))}
                      className="justify-self-start text-[14px] text-ink underline underline-offset-4"
                    >
                      Quitar este reto
                    </button>
                  )}
                </fieldset>
              );
            })}
            {permisos.edicionRetos === 'todo' && retos.length < permisos.maxRetos && (
              <button
                type="button"
                onClick={() =>
                  setRetos((rs) => [
                    ...rs,
                    {
                      id: nuevoId(),
                      tipo: 'dias',
                      meta: 4,
                      periodo: 'semana',
                      premio: '',
                      vigenciaDias: 7,
                    },
                  ])
                }
                className="min-h-[48px] justify-self-start border border-ink px-5 text-[15px] font-semibold text-ink"
              >
                Agregar un reto
              </button>
            )}
            {permisos.edicionRetos === 'premios' && (
              <p className="text-[13px] text-muted">
                Tu plan te deja cambiar las promociones; las metas son las de club-lealtad.
              </p>
            )}
          </div>
        )}
      </section>

      {listas.length > 0 && (
        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-xl text-ink">Lista de la semana</h2>
            <p className="max-w-prose text-[14px] text-muted">
              Una lista con los que más juegan anima a volver. Se muestra solo el nombre y la
              inicial del apellido.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={ETIQUETA}>
              Qué lista ven tus clientes
              <select
                className={CAMPO}
                value={lista.modo}
                onChange={(e) => setLista((l) => ({ ...l, modo: e.target.value as ModoLista }))}
              >
                {permisos.listas.map((m) => (
                  <option key={m} value={m}>
                    {NOMBRE_LISTA[m]}
                  </option>
                ))}
              </select>
            </label>
            {lista.modo !== 'ninguna' && (
              <label className={ETIQUETA}>
                Cuántos nombres
                <select
                  className={CAMPO}
                  value={lista.tamano}
                  onChange={(e) => setLista((l) => ({ ...l, tamano: Number(e.target.value) }))}
                >
                  {[5, 10, 15, 20, 30].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {(lista.modo === 'ranking' || lista.modo === 'rachas') && (
            <label className="flex items-center gap-3 text-[15px] text-ink">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--wl-tinta)]"
                checked={lista.mostrarPuntos}
                onChange={(e) => setLista((l) => ({ ...l, mostrarPuntos: e.target.checked }))}
              />
              Mostrar {lista.modo === 'rachas' ? 'los días de racha' : 'los puntos'}
            </label>
          )}
        </section>
      )}

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-xl text-ink">Tus productos en los juegos</h2>
          <p className="max-w-prose text-[14px] text-muted">
            Caen, se asoman y se juntan en los juegos. El primero es tu producto estrella y vale más
            puntos.
          </p>
        </div>
        <div className="flex flex-wrap gap-3" aria-hidden="true">
          {productos.map((p, i) => (
            <span key={`${p.icono}-${i}`} className="grid h-14 w-14 place-items-center bg-cream">
              <Miniatura nombre={p.icono} tema={temaVista} />
            </span>
          ))}
        </div>
        <div className="grid gap-3">
          {productos.map((p, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
              <label className={ETIQUETA}>
                {i === 0 ? 'Dibujo (estrella)' : `Dibujo ${i + 1}`}
                <select
                  className={CAMPO}
                  value={p.icono}
                  onChange={(e) =>
                    setProductos((ps) =>
                      ps.map((q, k) =>
                        k === i ? { ...q, icono: e.target.value as IconoArcade } : q,
                      ),
                    )
                  }
                >
                  {ICONOS_ARCADE.map((ic) => (
                    <option key={ic} value={ic}>
                      {NOMBRE_ICONO[ic]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={ETIQUETA}>
                Cómo se llama
                <input
                  className={CAMPO}
                  maxLength={40}
                  value={p.nombre}
                  onChange={(e) =>
                    setProductos((ps) =>
                      ps.map((q, k) => (k === i ? { ...q, nombre: e.target.value } : q)),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-xl text-ink">Palabras de la sopa de letras</h2>
          <p className="max-w-prose text-[14px] text-muted">
            De 4 a 20 palabras de tu negocio, de 3 a 10 letras, sin espacios. Si pones menos de 4,
            usamos las de tu giro.
          </p>
        </div>
        <textarea
          className={`${CAMPO} min-h-[96px] py-3 uppercase`}
          value={palabras}
          onChange={(e) => setPalabras(e.target.value)}
        />
        <p className="text-[13px] text-muted">
          {leidas.length} {leidas.length === 1 ? 'palabra lista' : 'palabras listas'}
          {descartadas.length > 0 ? ` · no se usarán: ${descartadas.slice(0, 5).join(', ')}` : ''}
        </p>
      </section>

      <div className="grid gap-3">
        {faltaPromocion && (
          <p className="text-[14px] text-muted">Escribe la promoción de cada reto para guardar.</p>
        )}
        {estado.error && (
          <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
            {estado.error}
          </p>
        )}
        {estado.ok && !guardando && (
          <p
            role="status"
            className="border-l-[3px] border-disponible px-3 py-2 text-[15px] text-ink"
          >
            Guardado. Tus clientes ya lo ven así.
          </p>
        )}
        <button
          type="submit"
          disabled={guardando || juegos.length === 0 || faltaPromocion}
          className="min-h-[52px] justify-self-start rounded-full bg-ink px-8 text-[16px] font-semibold text-cream disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
