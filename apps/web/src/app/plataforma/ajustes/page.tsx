import type { Metadata } from 'next';
import { plantillaArcade, preciosDelServicio } from '@wl/database';
import { ahorroAnual, pesos } from '@wl/domain';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { CamposPermisos } from '../FormPermisos';
import { MarcoPlataforma } from '../Marco';
import { guardarPlantilla, guardarPrecios } from '../acciones';

export const metadata: Metadata = { title: 'Precios y Arcade' };
export const dynamic = 'force-dynamic';

const CAMPO = 'min-h-[44px] w-36 border border-rule bg-cream px-3 text-[15px] text-ink';
const BOTON = 'min-h-[48px] rounded-full bg-ink px-6 text-[15px] font-semibold text-cream';

/** Precios del servicio y plantilla con la que se activa el Arcade a cada club. */
export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [precios, plantilla, { guardado }] = await Promise.all([
    preciosDelServicio(),
    plantillaArcade(),
    searchParams,
  ]);
  const campos = [
    ['lite-mes', 'Lite al mes', precios.lite.mes],
    ['lite-anio', 'Lite al año', precios.lite.anio],
    ['arcade-mes', 'Arcade al mes', precios.arcade.mes],
    ['arcade-anio', 'Arcade al año', precios.arcade.anio],
  ] as const;
  const ahorro = ahorroAnual(precios.lite);

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="ajustes"
      enTarjeta
      titulo="Precios y Arcade"
      descripcion="Lo que se cobra y lo que cada club puede usar del Arcade cuando se le activa."
    >
      <div className="grid max-w-3xl gap-10">
        {guardado && (
          <p role="status" className="rounded-md bg-ink px-4 py-3 text-[15px] text-cream">
            {guardado === 'precios' ? 'Precios guardados.' : 'Plantilla del Arcade guardada.'}
          </p>
        )}

        <section className="grid gap-4">
          <h2 className="text-xl text-ink">Precios (pesos, IVA incluido)</h2>
          <form action={guardarPrecios} className="grid gap-4">
            <div className="flex flex-wrap gap-5">
              {campos.map(([nombre, etiqueta, valor]) => (
                <label key={nombre} className="grid gap-1.5 text-[14px] text-muted">
                  {etiqueta}
                  <input
                    name={nombre}
                    inputMode="numeric"
                    defaultValue={valor ?? ''}
                    placeholder="Sin precio"
                    className={CAMPO}
                  />
                </label>
              ))}
            </div>
            <p className="max-w-prose text-[13px] text-muted">
              Vacío: no se publica precio y se muestra «Pregúntanos». Los cambios salen de inmediato
              en el sitio, el panel, Mi plan y los términos; los términos prometen avisar 30 días
              antes de un cambio de precio a quien ya paga.
              {ahorro ? ` Hoy el anual de Lite ahorra ${pesos(ahorro)}.` : ''}
            </p>
            <div>
              <button type="submit" className={BOTON}>
                Guardar precios
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl text-ink">Plantilla del Arcade</h2>
          <p className="max-w-prose text-[14px] text-muted">
            Con estos permisos se activa el Arcade a un club la primera vez que registras su pago.
            Después cada club se ajusta desde su ficha.
          </p>
          <form action={guardarPlantilla} className="grid gap-5">
            <CamposPermisos p={plantilla} />
            <div>
              <button type="submit" className={BOTON}>
                Guardar plantilla
              </button>
            </div>
          </form>
        </section>
      </div>
    </MarcoPlataforma>
  );
}
