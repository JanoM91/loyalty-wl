'use client';

import { useActionState, useState } from 'react';
import type { ProgramaLealtad } from '@wl/domain';

import { Alerta, BotonEnviar, Campo, claseEntrada } from '@/components/admin/Formulario';
import { guardar, type EstadoPrograma } from './acciones';

/**
 * Edición del programa: premios, tamaño de la tarjeta y regla de acumulación.
 *
 * Cada guardado publica una versión nueva (v3, v4…) y deja la anterior en el
 * historial. Lo ya ganado por los clientes no cambia: cada premio guardó su
 * nombre al ganarse.
 */

const MAX_HITOS = 6;
const MAX_TRAMOS = 8;

const pesos = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''));

export function FormularioPrograma({ programa }: { programa: ProgramaLealtad }) {
  const [estado, accion] = useActionState<EstadoPrograma, FormData>(guardar, {
    ok: false,
    problemas: [],
  });
  const [modalidad, setModalidad] = useState(programa.modalidad);
  const [hitos, setHitos] = useState(
    [...programa.hitos].sort((a, b) => a.posicion - b.posicion).map((h) => ({ ...h })),
  );
  const [tramos, setTramos] = useState(programa.tramos.map((t) => ({ ...t })));

  return (
    <form action={accion} className="grid gap-6">
      <section className="grid gap-4 rounded-lg border border-rule bg-cream p-4">
        <h2 className="font-sans text-base font-semibold text-ink">Tarjeta</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="posiciones"
            etiqueta="Estampas por tarjeta"
            ayuda="Al llenarse empieza una tarjeta nueva. Las imágenes de Wallet están hechas para 10."
          >
            <input
              id="posiciones"
              name="posiciones"
              type="number"
              min={1}
              max={30}
              defaultValue={programa.posiciones}
              required
              className={claseEntrada}
            />
          </Campo>
          <Campo
            id="ventana"
            etiqueta="Contingencia (días)"
            ayuda="Tickets de hasta estos días atrás quedan pendientes de revisión; más viejos se rechazan."
          >
            <input
              id="ventana"
              name="ventana"
              type="number"
              min={0}
              max={30}
              defaultValue={programa.ventanaContingenciaDias}
              required
              className={claseEntrada}
            />
          </Campo>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-rule bg-cream p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-sans text-base font-semibold text-ink">Premios</h2>
          <p className="text-xs text-muted">
            En qué estampa se gana cada premio y cómo se llama. Deja el nombre vacío para quitarlo.
          </p>
        </div>
        <ul className="grid gap-3">
          {hitos.map((h, i) => (
            <li
              key={i}
              className="grid gap-3 rounded-md border border-rule bg-white p-3 sm:grid-cols-[110px_minmax(0,1fr)]"
            >
              <input type="hidden" name={`hito-${i}-clave`} value={h.premio} />
              <input type="hidden" name={`hito-${i}-nombre-anterior`} value={h.nombre} />
              <Campo id={`hito-${i}-posicion`} etiqueta="Estampa">
                <input
                  id={`hito-${i}-posicion`}
                  name={`hito-${i}-posicion`}
                  type="number"
                  min={1}
                  max={30}
                  value={h.posicion}
                  onChange={(e) =>
                    setHitos(
                      hitos.map((x, j) =>
                        j === i ? { ...x, posicion: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  className={claseEntrada}
                />
              </Campo>
              <div className="grid gap-3">
                <Campo id={`hito-${i}-nombre`} etiqueta="Premio">
                  <input
                    id={`hito-${i}-nombre`}
                    name={`hito-${i}-nombre`}
                    maxLength={80}
                    value={h.nombre}
                    onChange={(e) =>
                      setHitos(
                        hitos.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)),
                      )
                    }
                    placeholder="Bebida + postre"
                    className={claseEntrada}
                  />
                </Campo>
                <Campo
                  id={`hito-${i}-incluye`}
                  etiqueta="Qué se entrega en el mostrador"
                  ayuda="Lo ve el cliente en su tarjeta y la caja al entregar."
                >
                  <input
                    id={`hito-${i}-incluye`}
                    name={`hito-${i}-incluye`}
                    maxLength={200}
                    value={h.incluye}
                    onChange={(e) =>
                      setHitos(
                        hitos.map((x, j) => (j === i ? { ...x, incluye: e.target.value } : x)),
                      )
                    }
                    className={claseEntrada}
                  />
                </Campo>
              </div>
            </li>
          ))}
        </ul>
        {hitos.length < MAX_HITOS && (
          <button
            type="button"
            onClick={() =>
              setHitos([
                ...hitos,
                { posicion: programa.posiciones, premio: '', nombre: '', incluye: '' },
              ])
            }
            className="justify-self-start text-sm font-medium text-crust-dark underline underline-offset-4"
          >
            + Agregar otro premio
          </button>
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-rule bg-cream p-4">
        <h2 className="font-sans text-base font-semibold text-ink">Cómo se gana</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-md border-[1.5px] bg-white p-3 ${modalidad === 'VISITA' ? 'border-ink' : 'border-rule'}`}
          >
            <input
              type="radio"
              name="modalidad"
              value="VISITA"
              checked={modalidad === 'VISITA'}
              onChange={() => setModalidad('VISITA')}
              className="mt-0.5 h-5 w-5 accent-ink"
            />
            <span className="text-sm">
              <b className="block font-semibold text-ink">Una estampa por visita</b>
              Sin importar el importe. Una visita por cliente, por día y por sucursal.
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-md border-[1.5px] bg-white p-3 ${modalidad === 'IMPORTE' ? 'border-ink' : 'border-rule'}`}
          >
            <input
              type="radio"
              name="modalidad"
              value="IMPORTE"
              checked={modalidad === 'IMPORTE'}
              onChange={() => setModalidad('IMPORTE')}
              className="mt-0.5 h-5 w-5 accent-ink"
            />
            <span className="text-sm">
              <b className="block font-semibold text-ink">Por importe del ticket</b>
              Según los tramos de abajo. Sigue siendo una visita por día y sucursal; la caja tendría
              que capturar el total.
            </span>
          </label>
        </div>

        <div className={modalidad === 'IMPORTE' ? '' : 'opacity-60'}>
          <p className="mb-2 text-xs text-muted">
            Tramos en pesos (el «hasta» no incluye el importe; vacío = sin tope).
            {modalidad === 'VISITA'
              ? ' Guardados pero sin usar mientras la modalidad sea por visita.'
              : ''}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[11px] text-muted">
                <th className="py-1.5 font-semibold">Desde</th>
                <th className="py-1.5 font-semibold">Hasta</th>
                <th className="py-1.5 font-semibold">Estampas</th>
              </tr>
            </thead>
            <tbody>
              {tramos.map((t, i) => (
                <tr key={i} className="border-b border-rule last:border-0">
                  <td className="py-1.5 pr-2">
                    <input
                      name={`tramo-${i}-desde`}
                      inputMode="decimal"
                      aria-label={`Tramo ${i + 1}: desde`}
                      value={pesos(t.desdeCentavos)}
                      onChange={(e) =>
                        setTramos(
                          tramos.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  desdeCentavos: Math.round(Number(e.target.value) * 100) || 0,
                                }
                              : x,
                          ),
                        )
                      }
                      className={`${claseEntrada} mt-0 font-mono`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      name={`tramo-${i}-hasta`}
                      inputMode="decimal"
                      aria-label={`Tramo ${i + 1}: hasta`}
                      defaultValue={pesos(t.hastaCentavos)}
                      placeholder="sin tope"
                      className={`${claseEntrada} mt-0 font-mono`}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      name={`tramo-${i}-estampas`}
                      type="number"
                      min={0}
                      max={30}
                      aria-label={`Tramo ${i + 1}: estampas`}
                      defaultValue={t.estampas}
                      className={`${claseEntrada} mt-0 font-mono`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tramos.length < MAX_TRAMOS && (
            <button
              type="button"
              onClick={() =>
                setTramos([
                  ...tramos,
                  {
                    desdeCentavos: tramos[tramos.length - 1]?.hastaCentavos ?? 0,
                    hastaCentavos: null,
                    estampas: 1,
                  },
                ])
              }
              className="mt-2 text-sm font-medium text-crust-dark underline underline-offset-4"
            >
              + Agregar tramo
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-rule bg-cream p-4">
        <Campo
          id="nota"
          etiqueta="Nota del cambio"
          ayuda="Queda en el historial de versiones. Por ejemplo: «Cambia el premio de la décima por decisión de dirección»."
        >
          <input id="nota" name="nota" maxLength={300} className={claseEntrada} />
        </Campo>

        {estado.problemas.length > 0 && (
          <Alerta tono="error">
            <span className="grid gap-1">
              {estado.problemas.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </span>
          </Alerta>
        )}
        {estado.ok && estado.version && (
          <Alerta tono="ok">
            Programa publicado como versión {estado.version}. Las tarjetas y los pases de Wallet ya
            lo muestran.
          </Alerta>
        )}

        <p className="text-xs text-muted">
          Al guardar se publica una versión nueva y entra en vigor de inmediato en caja, en la
          tarjeta de cada cliente y en Apple y Google Wallet. Los premios ya ganados conservan el
          nombre con el que se ganaron. Si cambias lo que se promete, actualiza también los términos
          del programa.
        </p>
        <div>
          <BotonEnviar texto="Publicar versión nueva" enviando="Publicando…" />
        </div>
      </section>
    </form>
  );
}
