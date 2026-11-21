/**
 * Programa de lealtad: qué se gana y cómo.
 *
 * Cada negocio define su programa: cuántas estampas caben en la tarjeta, en
 * qué posiciones hay premio y si la estampa se gana por visita o por importe.
 * El programa vigente se guarda en la base (`loyalty_program`, una versión
 * activa por negocio) y se edita desde el panel. Lo que hay en este archivo es:
 *
 * - la forma del programa (`ProgramaLealtad`) y cómo validarlo;
 * - `PROGRAMA_BASE`, un programa neutro que sirve de respaldo si la base no
 *   tiene ninguna versión activa legible y de punto de partida para un negocio
 *   nuevo.
 *
 * Cada acreditación y cada premio guardan la versión y el nombre del premio con
 * los que se hicieron, así que cambiar el programa no recalcula lo ya ganado.
 *
 * Todos los importes van en centavos.
 */

/**
 * Clave interna de un premio: letras mayúsculas, números y guion bajo
 * ("CORTESIA"). Es lo que se guarda en la base; el nombre que ve la gente va
 * aparte y puede cambiar sin tocar la clave.
 */
export type PremioLealtad = string;

export type ModalidadAcumulacion = 'VISITA' | 'IMPORTE';

export interface Hito {
  /** Estampa en la que se gana el premio, contando desde 1. */
  readonly posicion: number;
  /** Clave del premio. */
  readonly premio: PremioLealtad;
  /** Nombre corto que ve el cliente: "Café grande + postre". */
  readonly nombre: string;
  /** Qué se entrega exactamente en el mostrador. */
  readonly incluye: string;
}

/** Un tramo de importe para la modalidad por importe. `hasta` excluye. */
export interface Tramo {
  readonly desdeCentavos: number;
  readonly hastaCentavos: number | null;
  readonly estampas: number;
}

export interface ProgramaLealtad {
  readonly version: string;
  /** Estampas que caben en una tarjeta. Al llenarla empieza un ciclo nuevo. */
  readonly posiciones: number;
  readonly hitos: readonly Hito[];
  readonly modalidad: ModalidadAcumulacion;
  readonly tramos: readonly Tramo[];
  /**
   * Días hacia atrás en que todavía se acepta un ticket como contingencia
   * (sin internet en caja, tableta descargada). Más allá, va a revisión.
   */
  readonly ventanaContingenciaDias: number;
}

export interface DescripcionPremio {
  readonly nombre: string;
  /** Qué se entrega exactamente en el mostrador. */
  readonly incluye: string;
}

/**
 * Cómo describir un premio: lo que diga el programa vigente y, si la clave ya
 * no está en él (premio ganado con una versión anterior que no guardó su
 * nombre), la clave misma en minúsculas.
 */
export function describirPremio(programa: ProgramaLealtad, clave: string): DescripcionPremio {
  const hito = programa.hitos.find((h) => h.premio === clave);
  if (hito) return { nombre: hito.nombre, incluye: hito.incluye };
  return { nombre: clave.replace(/_/g, ' ').toLowerCase(), incluye: '' };
}

/**
 * Programa neutro: tarjeta de diez estampas, un premio de cortesía en la
 * quinta y el premio mayor en la décima; una estampa por visita. Respaldo de
 * la caja y punto de partida de un negocio nuevo.
 *
 * Los tramos están definidos aunque la modalidad sea por visita: quedan listos
 * para cuando el negocio decida probar la acumulación por importe.
 */
export const PROGRAMA_BASE: ProgramaLealtad = {
  version: 'v1',
  posiciones: 10,
  hitos: [
    {
      posicion: 5,
      premio: 'CORTESIA',
      nombre: 'Premio de cortesía',
      incluye: 'Una cortesía de la casa, a elección del negocio.',
    },
    {
      posicion: 10,
      premio: 'PREMIO_MAYOR',
      nombre: 'Premio mayor',
      incluye: 'El premio por completar la tarjeta.',
    },
  ],
  modalidad: 'VISITA',
  tramos: [
    { desdeCentavos: 0, hastaCentavos: 30_000, estampas: 1 },
    { desdeCentavos: 30_000, hastaCentavos: 50_000, estampas: 2 },
    { desdeCentavos: 50_000, hastaCentavos: 100_000, estampas: 3 },
    { desdeCentavos: 100_000, hastaCentavos: null, estampas: 4 },
  ],
  ventanaContingenciaDias: 2,
};

const CLAVE_PREMIO = /^[A-Z][A-Z0-9_]{1,39}$/;

/** "Café grande + postre" → "CAFE_GRANDE_POSTRE". */
export function clavePremioDesdeNombre(nombre: string): string {
  const clave = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return CLAVE_PREMIO.test(clave) ? clave : `PREMIO_${Math.abs(hashTexto(nombre))}`;
}

function hashTexto(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Revisa que un programa sea coherente antes de usarlo.
 *
 * Devuelve la lista de problemas en lenguaje del negocio; vacía si está bien.
 * La usan el panel al guardar y las pruebas: un error en esta configuración
 * regala o niega premios en todas las sucursales a la vez.
 */
export function validarPrograma(programa: ProgramaLealtad): string[] {
  const problemas: string[] = [];

  if (!/^v\d{1,4}$/.test(programa.version)) {
    problemas.push('La versión debe verse como "v3".');
  }

  if (
    !Number.isInteger(programa.posiciones) ||
    programa.posiciones < 1 ||
    programa.posiciones > 30
  ) {
    problemas.push('La tarjeta necesita entre 1 y 30 posiciones.');
  }

  if (programa.hitos.length === 0) {
    problemas.push('El programa necesita al menos un premio.');
  }

  const posiciones = new Set<number>();
  const claves = new Set<string>();
  for (const hito of programa.hitos) {
    if (!Number.isInteger(hito.posicion) || hito.posicion < 1) {
      problemas.push(`El premio en la posición ${hito.posicion} no es válido.`);
    } else if (hito.posicion > programa.posiciones) {
      problemas.push(
        `El premio en la posición ${hito.posicion} queda fuera de una tarjeta de ${programa.posiciones}.`,
      );
    }
    if (posiciones.has(hito.posicion)) {
      problemas.push(`Hay dos premios en la posición ${hito.posicion}.`);
    }
    posiciones.add(hito.posicion);

    if (!CLAVE_PREMIO.test(hito.premio)) {
      problemas.push(`La clave del premio en la posición ${hito.posicion} no es válida.`);
    }
    if (claves.has(hito.premio)) {
      problemas.push(`Dos premios comparten la clave ${hito.premio}.`);
    }
    claves.add(hito.premio);

    if (hito.nombre.trim().length < 3 || hito.nombre.length > 80) {
      problemas.push(
        `El premio en la posición ${hito.posicion} necesita un nombre (3 a 80 letras).`,
      );
    }
    if (hito.incluye.length > 200) {
      problemas.push(
        `La descripción del premio en la posición ${hito.posicion} es demasiado larga.`,
      );
    }
  }

  if (programa.modalidad !== 'VISITA' && programa.modalidad !== 'IMPORTE') {
    problemas.push('La modalidad debe ser por visita o por importe.');
  }
  if (programa.modalidad === 'IMPORTE' && programa.tramos.length === 0) {
    problemas.push('La modalidad por importe necesita al menos un tramo.');
  }

  const tramos = [...programa.tramos].sort((a, b) => a.desdeCentavos - b.desdeCentavos);
  tramos.forEach((tramo, i) => {
    if (tramo.estampas < 0 || !Number.isInteger(tramo.estampas)) {
      problemas.push(`El tramo ${i + 1} otorga un número de sellos inválido.`);
    }
    if (!Number.isInteger(tramo.desdeCentavos) || tramo.desdeCentavos < 0) {
      problemas.push(`El tramo ${i + 1} empieza en un importe inválido.`);
    }
    if (tramo.hastaCentavos !== null && tramo.hastaCentavos <= tramo.desdeCentavos) {
      problemas.push(`El tramo ${i + 1} termina antes de empezar.`);
    }
    const siguiente = tramos[i + 1];
    if (siguiente) {
      if (tramo.hastaCentavos === null) {
        problemas.push(`El tramo ${i + 1} no tiene tope y no puede ir antes de otro.`);
      } else if (siguiente.desdeCentavos < tramo.hastaCentavos) {
        problemas.push(`Los tramos ${i + 1} y ${i + 2} se enciman.`);
      } else if (siguiente.desdeCentavos > tramo.hastaCentavos) {
        problemas.push(`Entre los tramos ${i + 1} y ${i + 2} hay importes sin sellos.`);
      }
    }
  });

  if (
    !Number.isInteger(programa.ventanaContingenciaDias) ||
    programa.ventanaContingenciaDias < 0 ||
    programa.ventanaContingenciaDias > 30
  ) {
    problemas.push('La ventana de contingencia debe ser un número de días (0 a 30).');
  }

  return problemas;
}

// ---------------------------------------------------------------------------
// Lectura desde JSON (lo que guarda la base)
// ---------------------------------------------------------------------------

type Desconocido = Record<string, unknown>;

const esObjeto = (v: unknown): v is Desconocido => typeof v === 'object' && v !== null;
const entero = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) ? v : NaN);

/**
 * Construye un programa a partir de los campos guardados en la base.
 *
 * Devuelve null si la forma no es la esperada. Que sea válido como regla de
 * negocio lo decide `validarPrograma`; aquí solo se comprueba el tipo de cada
 * campo, para que un JSON malformado no tire la caja.
 */
export function programaDesdeDatos(d: {
  readonly version: string;
  readonly posiciones: number;
  readonly modalidad: string;
  readonly hitos: unknown;
  readonly tramos: unknown;
  readonly ventanaContingenciaDias: number;
}): ProgramaLealtad | null {
  if (!Array.isArray(d.hitos) || !Array.isArray(d.tramos)) return null;
  if (d.modalidad !== 'VISITA' && d.modalidad !== 'IMPORTE') return null;

  const hitos: Hito[] = [];
  for (const h of d.hitos) {
    if (!esObjeto(h) || typeof h.premio !== 'string') return null;
    hitos.push({
      posicion: entero(h.posicion),
      premio: h.premio,
      nombre: typeof h.nombre === 'string' ? h.nombre : h.premio,
      incluye: typeof h.incluye === 'string' ? h.incluye : '',
    });
  }

  const tramos: Tramo[] = [];
  for (const t of d.tramos) {
    if (!esObjeto(t)) return null;
    tramos.push({
      desdeCentavos: entero(t.desdeCentavos),
      hastaCentavos: t.hastaCentavos === null ? null : entero(t.hastaCentavos),
      estampas: entero(t.estampas),
    });
  }

  return {
    version: d.version,
    posiciones: d.posiciones,
    hitos,
    modalidad: d.modalidad,
    tramos,
    ventanaContingenciaDias: d.ventanaContingenciaDias,
  };
}
