import type { NegocioEnLista } from '@wl/database';

import { estadoDelClub, type EstadoClub } from './panel';

/** Grupos de clubes a los que se puede mandar un aviso. */
const GRUPOS: readonly { valor: string; etiqueta: string; estado: EstadoClub | null }[] = [
  { valor: 'todos', etiqueta: 'Todos los clubes', estado: null },
  { valor: 'activo', etiqueta: 'Clubes activos', estado: 'activo' },
  { valor: 'prueba', etiqueta: 'Clubes en prueba', estado: 'prueba' },
  { valor: 'pausa', etiqueta: 'Clubes en pausa', estado: 'pausa' },
];

export interface Audiencia {
  /** Lo que viaja en el formulario: «todos», «prueba», «club:tacos-el-guero». */
  readonly valor: string;
  /** Cómo se lee y cómo queda en el historial. */
  readonly etiqueta: string;
  readonly clubes: readonly NegocioEnLista[];
}

/**
 * Las audiencias posibles: los grupos y cada club por separado. Los grupos
 * dejan fuera a los clubes suspendidos; a uno suspendido solo se le escribe
 * eligiéndolo por su nombre.
 */
export function audiencias(
  negocios: readonly NegocioEnLista[],
  ahora: Date = new Date(),
): { grupos: Audiencia[]; clubes: Audiencia[] } {
  const vivos = negocios.filter((f) => f.negocio.activo);
  return {
    grupos: GRUPOS.map((g) => ({
      valor: g.valor,
      etiqueta: g.etiqueta,
      clubes: g.estado ? vivos.filter((f) => estadoDelClub(f, ahora) === g.estado) : vivos,
    })),
    clubes: [...negocios]
      .sort((a, b) => a.negocio.nombre.localeCompare(b.negocio.nombre, 'es'))
      .map((f) => ({
        valor: `club:${f.negocio.slug}`,
        etiqueta: f.negocio.nombre,
        clubes: [f],
      })),
  };
}

export function audienciaDe(
  valor: string,
  negocios: readonly NegocioEnLista[],
  ahora: Date = new Date(),
): Audiencia | null {
  const { grupos, clubes } = audiencias(negocios, ahora);
  return [...grupos, ...clubes].find((a) => a.valor === valor) ?? null;
}
