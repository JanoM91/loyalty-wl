import { JUEGOS, MODOS_LISTA, NOMBRE_LISTA, type PermisosArcade } from '@wl/domain';

const CAMPO = 'min-h-[44px] w-24 border border-rule bg-cream px-3 text-[15px] text-ink';

/**
 * Campos de los permisos del Arcade: los mismos para la plantilla y para cada
 * club. Sin JavaScript: el formulario lo lee `permisosDelFormulario`.
 */
export function CamposPermisos({ p }: { p: PermisosArcade }) {
  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[15px] font-semibold text-ink">Juegos incluidos</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {JUEGOS.map((j) => (
            <label key={j.id} className="flex min-h-[40px] items-center gap-2 text-[15px] text-ink">
              <input
                type="checkbox"
                name={`juego-${j.id}`}
                defaultChecked={p.juegos.includes(j.id)}
                className="size-5"
              />
              {j.nombre}
              {!j.disponible && <span className="text-[12px] text-muted">(próximamente)</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-5">
        {(
          [
            ['maxJuegosActivos', 'Juegos activos a la vez', p.maxJuegosActivos, 1, 12],
            ['maxPartidasDia', 'Partidas por día', p.maxPartidasDia, 1, 20],
            ['maxRetos', 'Retos', p.maxRetos, 0, 10],
          ] as const
        ).map(([nombre, etiqueta, valor, min, max]) => (
          <label key={nombre} className="grid gap-1.5 text-[14px] text-muted">
            {etiqueta} (máx.)
            <input
              type="number"
              name={nombre}
              defaultValue={valor}
              min={min}
              max={max}
              className={CAMPO}
            />
          </label>
        ))}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-[15px] font-semibold text-ink">Listas que puede usar</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODOS_LISTA.map((m) => (
            <label key={m} className="flex min-h-[40px] items-center gap-2 text-[15px] text-ink">
              <input
                type="checkbox"
                name={`lista-${m}`}
                defaultChecked={p.listas.includes(m)}
                disabled={m === 'ninguna'}
                className="size-5"
              />
              {NOMBRE_LISTA[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid max-w-md gap-1.5 text-[14px] text-muted">
        Qué puede cambiar el dueño de los retos
        <select
          name="edicionRetos"
          defaultValue={p.edicionRetos}
          className="min-h-[44px] border border-rule bg-cream px-3 text-[15px] text-ink"
        >
          <option value="todo">Metas y premios</option>
          <option value="premios">Solo los premios (metas de la plantilla)</option>
          <option value="ninguna">Nada (retos de la plantilla)</option>
        </select>
      </label>
    </div>
  );
}
