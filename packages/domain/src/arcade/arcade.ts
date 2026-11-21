/**
 * Arcade del club: juegos de habilidad dentro de la tarjeta del cliente que
 * desbloquean promociones (nunca sellos).
 *
 * Tres capas de reglas:
 * 1. **Permisos** (`PermisosArcade`): los fija la plataforma por club, según lo
 *    que pague: si tiene el Arcade, hasta cuándo, qué juegos, cuántos retos,
 *    qué listas y qué puede editar el dueño. Viven en los ajustes del negocio,
 *    que el negocio no puede cambiar.
 * 2. **Configuración** (`ConfigArcade`): la arma el dueño desde su panel.
 * 3. **Configuración efectiva**: la del dueño recortada a sus permisos. Es la
 *    única que se usa para jugar; así un permiso retirado surte efecto sin
 *    tocar lo que el dueño guardó.
 *
 * Solo habilidad y constancia, sin azar: en México los sorteos requieren
 * permiso de la Secretaría de Gobernación.
 */

import { sumarDias } from '../shared/fecha';

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const IDS_JUEGO = [
  'atrapa',
  'memorama',
  'asoma',
  'donde',
  'junta',
  'sopa',
  'apila',
  'salta',
  'repite',
  'rebota',
  'rebana',
  'encesta',
] as const;
export type IdJuego = (typeof IDS_JUEGO)[number];

export interface JuegoArcade {
  readonly id: IdJuego;
  readonly nombre: string;
  readonly dificultad: 'Muy fácil' | 'Fácil' | 'Media';
  /** Ya se puede jugar en la tarjeta. Los demás se ven como «Próximamente». */
  readonly disponible: boolean;
  /**
   * Tope generoso de puntos por segundo de juego, más un bono por nivel. Una
   * partida que lo rebasa se guarda como sospechosa y no cuenta para retos
   * ni listas.
   */
  readonly puntosPorSegundo: number;
  readonly bonoPorNivel: number;
}

export const JUEGOS: readonly JuegoArcade[] = [
  {
    id: 'atrapa',
    nombre: 'Atrapa',
    dificultad: 'Muy fácil',
    disponible: true,
    puntosPorSegundo: 90,
    bonoPorNivel: 0,
  },
  {
    id: 'memorama',
    nombre: 'Memorama',
    dificultad: 'Muy fácil',
    disponible: true,
    puntosPorSegundo: 30,
    bonoPorNivel: 60,
  },
  {
    id: 'asoma',
    nombre: 'Asoma',
    dificultad: 'Muy fácil',
    disponible: true,
    puntosPorSegundo: 90,
    bonoPorNivel: 0,
  },
  {
    id: 'donde',
    nombre: '¿Dónde quedó?',
    dificultad: 'Fácil',
    disponible: true,
    puntosPorSegundo: 12,
    bonoPorNivel: 40,
  },
  {
    id: 'junta',
    nombre: 'Junta',
    dificultad: 'Fácil',
    disponible: true,
    puntosPorSegundo: 400,
    bonoPorNivel: 7000,
  },
  {
    id: 'sopa',
    nombre: 'Sopa de letras',
    dificultad: 'Fácil',
    disponible: true,
    puntosPorSegundo: 15,
    bonoPorNivel: 80,
  },
  {
    id: 'apila',
    nombre: 'Apila',
    dificultad: 'Muy fácil',
    disponible: false,
    puntosPorSegundo: 60,
    bonoPorNivel: 0,
  },
  {
    id: 'salta',
    nombre: 'Salta',
    dificultad: 'Fácil',
    disponible: false,
    puntosPorSegundo: 60,
    bonoPorNivel: 0,
  },
  {
    id: 'repite',
    nombre: 'Repite',
    dificultad: 'Fácil',
    disponible: false,
    puntosPorSegundo: 40,
    bonoPorNivel: 0,
  },
  {
    id: 'rebota',
    nombre: 'Rebota',
    dificultad: 'Media',
    disponible: false,
    puntosPorSegundo: 120,
    bonoPorNivel: 60,
  },
  {
    id: 'rebana',
    nombre: 'Rebana',
    dificultad: 'Fácil',
    disponible: false,
    puntosPorSegundo: 120,
    bonoPorNivel: 0,
  },
  {
    id: 'encesta',
    nombre: 'Encesta',
    dificultad: 'Media',
    disponible: false,
    puntosPorSegundo: 40,
    bonoPorNivel: 0,
  },
];

export function juegoPorId(id: string): JuegoArcade | null {
  return JUEGOS.find((j) => j.id === id) ?? null;
}

const esJuego = (v: unknown): v is IdJuego =>
  typeof v === 'string' && (IDS_JUEGO as readonly string[]).includes(v);

// ---------------------------------------------------------------------------
// Dibujos y palabras por giro
// ---------------------------------------------------------------------------

/** Dibujos de la biblioteca (los dibuja el motor de juegos). */
export const ICONOS_ARCADE = [
  'taza',
  'concha',
  'croissant',
  'grano',
  'tijeras',
  'navaja',
  'brocha',
  'peine',
  'esmalte',
  'gema',
  'lima',
  'flor',
  'regalo',
  'bolsa',
  'estrella',
  'corazon',
] as const;
export type IconoArcade = (typeof ICONOS_ARCADE)[number];

export interface ProductoArcade {
  readonly icono: IconoArcade;
  /** Nombre que ve el cliente: «Concha de vainilla». */
  readonly nombre: string;
}

const PRODUCTOS_POR_GIRO: Record<string, readonly ProductoArcade[]> = {
  barberia: [
    { icono: 'tijeras', nombre: 'Corte' },
    { icono: 'navaja', nombre: 'Afeitado' },
    { icono: 'brocha', nombre: 'Barba' },
    { icono: 'peine', nombre: 'Peinado' },
  ],
  peluqueria: [
    { icono: 'tijeras', nombre: 'Corte' },
    { icono: 'peine', nombre: 'Peinado' },
    { icono: 'brocha', nombre: 'Tinte' },
    { icono: 'flor', nombre: 'Tratamiento' },
  ],
  salon: [
    { icono: 'flor', nombre: 'Tratamiento' },
    { icono: 'esmalte', nombre: 'Uñas' },
    { icono: 'gema', nombre: 'Diseño' },
    { icono: 'peine', nombre: 'Peinado' },
  ],
  unas: [
    { icono: 'esmalte', nombre: 'Gelish' },
    { icono: 'gema', nombre: 'Diseño' },
    { icono: 'lima', nombre: 'Manicure' },
    { icono: 'flor', nombre: 'Spa de manos' },
  ],
  cafeteria: [
    { icono: 'taza', nombre: 'Café' },
    { icono: 'concha', nombre: 'Concha' },
    { icono: 'croissant', nombre: 'Croissant' },
    { icono: 'grano', nombre: 'Grano de la casa' },
  ],
  panaderia: [
    { icono: 'concha', nombre: 'Concha' },
    { icono: 'croissant', nombre: 'Cuernito' },
    { icono: 'taza', nombre: 'Café' },
    { icono: 'corazon', nombre: 'Pan de la casa' },
  ],
  reposteria: [
    { icono: 'concha', nombre: 'Pan dulce' },
    { icono: 'corazon', nombre: 'Pastel' },
    { icono: 'croissant', nombre: 'Croissant' },
    { icono: 'taza', nombre: 'Café' },
  ],
};

const PRODUCTOS_GENERICOS: readonly ProductoArcade[] = [
  { icono: 'regalo', nombre: 'Regalo' },
  { icono: 'bolsa', nombre: 'Compra' },
  { icono: 'estrella', nombre: 'Favorito' },
  { icono: 'corazon', nombre: 'Lo de siempre' },
];

const PALABRAS_POR_GIRO: Record<string, readonly string[]> = {
  barberia: [
    'CORTE',
    'BARBA',
    'NAVAJA',
    'PEINE',
    'TIJERA',
    'FADE',
    'BIGOTE',
    'ESPUMA',
    'CERA',
    'FILO',
  ],
  peluqueria: [
    'CORTE',
    'TINTE',
    'PEINE',
    'RIZOS',
    'MECHAS',
    'BRUSHING',
    'TIJERA',
    'LACIO',
    'CERA',
    'BRILLO',
  ],
  salon: [
    'UÑAS',
    'PEINADO',
    'FACIAL',
    'MASAJE',
    'CEJAS',
    'PESTAÑAS',
    'TINTE',
    'BRILLO',
    'SPA',
    'ROSA',
  ],
  unas: [
    'GELISH',
    'LIMA',
    'GEMA',
    'ESMALTE',
    'BRILLO',
    'DISEÑO',
    'MANOS',
    'CORAL',
    'ROSA',
    'ACRILICO',
  ],
  cafeteria: [
    'CAFE',
    'CONCHA',
    'TAZA',
    'LECHE',
    'CANELA',
    'AZUCAR',
    'MOLINO',
    'CREMA',
    'PAN',
    'AROMA',
  ],
  panaderia: [
    'CONCHA',
    'BOLILLO',
    'HORNO',
    'HARINA',
    'CUERNITO',
    'DONA',
    'TELERA',
    'AZUCAR',
    'PAN',
    'MASA',
  ],
  reposteria: [
    'PASTEL',
    'GALLETA',
    'CREMA',
    'CHOCOLATE',
    'FRESA',
    'BETUN',
    'HORNO',
    'AZUCAR',
    'VAINILLA',
    'FLAN',
  ],
};

const PALABRAS_GENERICAS = [
  'CLUB',
  'PREMIO',
  'SELLO',
  'TARJETA',
  'REGALO',
  'VISITA',
  'CLIENTE',
  'PUNTOS',
  'GANAR',
  'AMIGOS',
];

export function productosPorGiro(giro: string | null | undefined): readonly ProductoArcade[] {
  return PRODUCTOS_POR_GIRO[giro ?? ''] ?? PRODUCTOS_GENERICOS;
}

export function palabrasPorGiro(giro: string | null | undefined): readonly string[] {
  return PALABRAS_POR_GIRO[giro ?? ''] ?? PALABRAS_GENERICAS;
}

/** Palabra válida para la sopa: de 3 a 10 letras, sin espacios ni signos (acepta Ñ). */
export function normalizarPalabra(texto: string): string | null {
  const p = texto.trim().toUpperCase().normalize('NFD').replace(/Ñ/g, 'Ñ').replace(/[̀-ͯ]/g, '');
  return /^[A-ZÑ]{3,10}$/.test(p) ? p : null;
}

// ---------------------------------------------------------------------------
// Retos
// ---------------------------------------------------------------------------

export const TIPOS_RETO = ['dias', 'partidas', 'puntaje', 'acumulado', 'juegos', 'nivel'] as const;
export type TipoReto = (typeof TIPOS_RETO)[number];
export type PeriodoReto = 'semana' | 'mes';

export interface Reto {
  /** Identificador estable: el cupón de un reto se gana una vez por periodo. */
  readonly id: string;
  readonly tipo: TipoReto;
  readonly meta: number;
  readonly periodo: PeriodoReto;
  /** Promoción que se desbloquea: «10% en tu siguiente visita». */
  readonly premio: string;
  /** Días que dura el cupón para cobrarse en caja. */
  readonly vigenciaDias: number;
}

/** Límites de cada meta: el dueño no puede regalar promociones con retos triviales. */
export const LIMITES_META: Record<TipoReto, { readonly min: number; readonly max: number }> = {
  dias: { min: 3, max: 31 },
  partidas: { min: 5, max: 200 },
  puntaje: { min: 300, max: 100_000 },
  acumulado: { min: 2_000, max: 1_000_000 },
  juegos: { min: 2, max: 12 },
  nivel: { min: 3, max: 50 },
};

export function textoReto(r: Pick<Reto, 'tipo' | 'meta' | 'periodo'>): string {
  const cuando = r.periodo === 'semana' ? 'esta semana' : 'este mes';
  const n = r.meta.toLocaleString('es-MX');
  switch (r.tipo) {
    case 'dias':
      return `Juega ${n} días distintos ${cuando}`;
    case 'partidas':
      return `Juega ${n} partidas ${cuando}`;
    case 'puntaje':
      return `Haz ${n} puntos en una partida ${cuando}`;
    case 'acumulado':
      return `Junta ${n} puntos ${cuando}`;
    case 'juegos':
      return `Juega ${n} juegos distintos ${cuando}`;
    case 'nivel':
      return `Llega al nivel ${n} ${cuando}`;
  }
}

/** Retos con los que arranca un club: exigentes a propósito. */
export const RETOS_POR_OMISION: readonly Reto[] = [
  {
    id: 'constancia',
    tipo: 'dias',
    meta: 5,
    periodo: 'semana',
    premio: '10% de descuento en tu siguiente visita',
    vigenciaDias: 7,
  },
  {
    id: 'maestria',
    tipo: 'puntaje',
    meta: 800,
    periodo: 'semana',
    premio: 'Un producto de cortesía con tu compra',
    vigenciaDias: 7,
  },
  {
    id: 'fiel',
    tipo: 'partidas',
    meta: 40,
    periodo: 'mes',
    premio: '2x1 en tu siguiente compra',
    vigenciaDias: 10,
  },
];

/** Resumen de una partida terminada y válida, para medir retos. */
export interface PartidaResumen {
  /** Día civil del negocio: "2026-11-21". */
  readonly dia: string;
  readonly juego: string;
  readonly puntos: number;
  readonly nivel: number;
}

/** Lunes de la semana (ISO) a la que pertenece un día civil. */
export function lunesDe(dia: string): string {
  const [a = 0, m = 1, d = 1] = dia.split('-').map(Number);
  const semana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 domingo
  return sumarDias(dia, -((semana + 6) % 7));
}

/** Primer día del periodo que contiene a `dia`. */
export function inicioDePeriodo(periodo: PeriodoReto, dia: string): string {
  return periodo === 'semana' ? lunesDe(dia) : `${dia.slice(0, 7)}-01`;
}

/** Clave del periodo para no repetir cupones: "S2026-11-16" o "M2026-11". */
export function clavePeriodo(periodo: PeriodoReto, dia: string): string {
  return periodo === 'semana' ? `S${lunesDe(dia)}` : `M${dia.slice(0, 7)}`;
}

/** Avance de un reto con las partidas válidas del periodo. */
export function avanceReto(reto: Pick<Reto, 'tipo'>, partidas: readonly PartidaResumen[]): number {
  switch (reto.tipo) {
    case 'dias':
      return new Set(partidas.map((p) => p.dia)).size;
    case 'partidas':
      return partidas.length;
    case 'puntaje':
      return partidas.reduce((m, p) => Math.max(m, p.puntos), 0);
    case 'acumulado':
      return partidas.reduce((s, p) => s + p.puntos, 0);
    case 'juegos':
      return new Set(partidas.map((p) => p.juego)).size;
    case 'nivel':
      return partidas.reduce((m, p) => Math.max(m, p.nivel), 0);
  }
}

/** Días seguidos jugados que terminan hoy o ayer (una racha no se rompe hasta que pasa el día). */
export function racha(diasJugados: Iterable<string>, hoy: string): number {
  const dias = new Set(diasJugados);
  let cursor = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (dias.has(cursor)) {
    n += 1;
    cursor = sumarDias(cursor, -1);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Validación de partidas
// ---------------------------------------------------------------------------

/** Una partida dura al menos esto para contar. */
export const SEGUNDOS_MINIMOS = 3;
/** Una partida abierta por más de esto ya no se acepta. */
export const SEGUNDOS_MAXIMOS = 20 * 60;

/** ¿Es creíble el puntaje para el tiempo jugado? */
export function puntajeCreible(
  juego: IdJuego,
  puntos: number,
  nivel: number,
  segundos: number,
): boolean {
  const j = juegoPorId(juego);
  if (!j) return false;
  if (!Number.isInteger(puntos) || !Number.isInteger(nivel) || puntos < 0 || nivel < 1)
    return false;
  if (segundos < SEGUNDOS_MINIMOS || segundos > SEGUNDOS_MAXIMOS) return false;
  if (nivel > 2 + Math.ceil(segundos / 3)) return false;
  return puntos <= j.puntosPorSegundo * segundos + j.bonoPorNivel * nivel * (nivel + 1);
}

// ---------------------------------------------------------------------------
// Permisos (plataforma) y configuración (dueño)
// ---------------------------------------------------------------------------

export const MODOS_LISTA = ['ninguna', 'ranking', 'aleatoria', 'rachas'] as const;
export type ModoLista = (typeof MODOS_LISTA)[number];

export const NOMBRE_LISTA: Record<ModoLista, string> = {
  ninguna: 'Sin lista',
  ranking: 'Ranking semanal',
  aleatoria: 'Jugadores de la semana (orden aleatorio)',
  rachas: 'Rachas más largas',
};

/** Qué puede cambiar el dueño de los retos. */
export type EdicionRetos = 'ninguna' | 'premios' | 'todo';

export interface PermisosArcade {
  readonly activo: boolean;
  /** Fin del periodo pagado del Arcade (ISO). Sin fecha no se juega. */
  readonly pagadoHasta: string | null;
  readonly juegos: readonly IdJuego[];
  readonly maxJuegosActivos: number;
  readonly maxPartidasDia: number;
  readonly maxRetos: number;
  readonly listas: readonly ModoLista[];
  readonly edicionRetos: EdicionRetos;
}

/** Plantilla con la que la plataforma activa el Arcade a un club. */
export const PERMISOS_POR_OMISION: PermisosArcade = {
  activo: false,
  pagadoHasta: null,
  juegos: JUEGOS.filter((j) => j.disponible).map((j) => j.id),
  maxJuegosActivos: 3,
  maxPartidasDia: 3,
  maxRetos: 3,
  listas: ['ninguna', 'ranking', 'aleatoria', 'rachas'],
  edicionRetos: 'todo',
};

export interface ListaArcade {
  readonly modo: ModoLista;
  /** Cuántos nombres muestra. */
  readonly tamano: number;
  readonly mostrarPuntos: boolean;
}

export interface ConfigArcade {
  readonly juegos: readonly IdJuego[];
  /** `fijos`: los juegos elegidos. `semana`: uno de ellos, que cambia cada lunes. */
  readonly modo: 'fijos' | 'semana';
  readonly partidasDia: number;
  readonly retos: readonly Reto[];
  readonly lista: ListaArcade;
  readonly productos: readonly ProductoArcade[];
  readonly palabras: readonly string[];
}

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const entero = (v: unknown, d: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;
const texto = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const unicos = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

export function leerPermisosArcade(json: unknown): PermisosArcade | null {
  if (json === undefined || json === null) return null;
  const a = objeto(json);
  const d = PERMISOS_POR_OMISION;
  const juegos = unicos(lista(a.juegos).filter(esJuego));
  const listas = unicos(
    lista(a.listas).filter((m): m is ModoLista => (MODOS_LISTA as readonly unknown[]).includes(m)),
  );
  const pagado = typeof a.pagadoHasta === 'string' && !Number.isNaN(Date.parse(a.pagadoHasta));
  return {
    activo: a.activo === true,
    pagadoHasta: pagado ? (a.pagadoHasta as string) : null,
    juegos: Array.isArray(a.juegos) ? juegos : d.juegos,
    maxJuegosActivos: entero(a.maxJuegosActivos, d.maxJuegosActivos, 1, IDS_JUEGO.length),
    maxPartidasDia: entero(a.maxPartidasDia, d.maxPartidasDia, 1, 20),
    maxRetos: entero(a.maxRetos, d.maxRetos, 0, 10),
    listas: listas.length
      ? listas.includes('ninguna')
        ? listas
        : ['ninguna', ...listas]
      : ['ninguna'],
    edicionRetos:
      a.edicionRetos === 'ninguna' || a.edicionRetos === 'premios' ? a.edicionRetos : 'todo',
  };
}

/** ¿Pueden jugar hoy los clientes de este club? */
export function arcadeVigente(p: PermisosArcade | null, ahora: Date = new Date()): boolean {
  if (!p || !p.activo || !p.pagadoHasta) return false;
  return Date.parse(p.pagadoHasta) > ahora.getTime();
}

function leerReto(v: unknown, i: number): Reto | null {
  const r = objeto(v);
  if (!(TIPOS_RETO as readonly unknown[]).includes(r.tipo)) return null;
  const tipo = r.tipo as TipoReto;
  const lim = LIMITES_META[tipo];
  const premio = texto(r.premio, 120);
  if (!premio) return null;
  const id = typeof r.id === 'string' && /^[a-z0-9-]{1,40}$/.test(r.id) ? r.id : `reto-${i + 1}`;
  return {
    id,
    tipo,
    meta: entero(r.meta, lim.min, lim.min, lim.max),
    periodo: r.periodo === 'mes' ? 'mes' : 'semana',
    premio,
    vigenciaDias: entero(r.vigenciaDias, 7, 1, 60),
  };
}

/** Lo que guardó el dueño, sin recortar todavía a sus permisos. */
export function leerConfigArcade(json: unknown): Partial<ConfigArcade> {
  if (json === undefined || json === null) return {};
  const c = objeto(json);
  const salida: { -readonly [K in keyof ConfigArcade]?: ConfigArcade[K] } = {};
  if (Array.isArray(c.juegos)) salida.juegos = unicos(c.juegos.filter(esJuego));
  if (c.modo === 'fijos' || c.modo === 'semana') salida.modo = c.modo;
  if (typeof c.partidasDia === 'number') salida.partidasDia = entero(c.partidasDia, 3, 1, 20);
  if (Array.isArray(c.retos)) {
    const vistos = new Set<string>();
    salida.retos = c.retos
      .map(leerReto)
      .filter((r): r is Reto => r !== null && !vistos.has(r.id) && Boolean(vistos.add(r.id)));
  }
  if (c.lista !== undefined) {
    const l = objeto(c.lista);
    salida.lista = {
      modo: (MODOS_LISTA as readonly unknown[]).includes(l.modo)
        ? (l.modo as ModoLista)
        : 'ranking',
      tamano: entero(l.tamano, 10, 3, 30),
      mostrarPuntos: l.mostrarPuntos !== false,
    };
  }
  if (Array.isArray(c.productos)) {
    salida.productos = c.productos
      .map((v) => {
        const p = objeto(v);
        const icono = (ICONOS_ARCADE as readonly unknown[]).includes(p.icono)
          ? (p.icono as IconoArcade)
          : null;
        const nombre = texto(p.nombre, 40);
        return icono && nombre ? { icono, nombre } : null;
      })
      .filter((p): p is ProductoArcade => p !== null)
      .slice(0, 4);
  }
  if (Array.isArray(c.palabras)) {
    salida.palabras = unicos(
      c.palabras
        .map((w) => (typeof w === 'string' ? normalizarPalabra(w) : null))
        .filter((w): w is string => w !== null),
    ).slice(0, 20);
  }
  return salida;
}

/**
 * La configuración con la que se juega: la del dueño recortada a sus permisos
 * y completada con lo de su giro donde falte.
 */
export function configEfectiva(
  guardada: Partial<ConfigArcade>,
  permisos: PermisosArcade,
  giro: string | null | undefined,
): ConfigArcade {
  const permitidos = permisos.juegos.filter((j) => juegoPorId(j)?.disponible);
  let juegos = (guardada.juegos ?? []).filter((j) => permitidos.includes(j));
  if (juegos.length === 0) juegos = permitidos;
  juegos = juegos.slice(0, permisos.maxJuegosActivos);

  const retosBase =
    permisos.edicionRetos === 'ninguna' ? RETOS_POR_OMISION : (guardada.retos ?? RETOS_POR_OMISION);
  const retos = retosBase
    .map((r) => {
      if (permisos.edicionRetos !== 'premios') return r;
      // Solo premios: tipo, meta y periodo son los de la plantilla con el mismo id.
      const base = RETOS_POR_OMISION.find((b) => b.id === r.id);
      return base ? { ...base, premio: r.premio, vigenciaDias: r.vigenciaDias } : null;
    })
    .filter((r): r is Reto => r !== null)
    .slice(0, permisos.maxRetos);

  const lista: ListaArcade = guardada.lista ?? { modo: 'ranking', tamano: 10, mostrarPuntos: true };
  const productos = guardada.productos?.length ? guardada.productos : productosPorGiro(giro);
  const palabras =
    guardada.palabras && guardada.palabras.length >= 4 ? guardada.palabras : palabrasPorGiro(giro);

  return {
    juegos,
    modo: guardada.modo ?? 'fijos',
    partidasDia: Math.min(guardada.partidasDia ?? permisos.maxPartidasDia, permisos.maxPartidasDia),
    retos,
    lista: permisos.listas.includes(lista.modo) ? lista : { ...lista, modo: 'ninguna' },
    productos,
    palabras,
  };
}

/** Juegos que se pueden jugar hoy: todos los activos, o uno por semana. */
export function juegosDeHoy(config: Pick<ConfigArcade, 'juegos' | 'modo'>, hoy: string): IdJuego[] {
  if (config.modo === 'fijos' || config.juegos.length <= 1) return [...config.juegos];
  const lunes = Date.parse(`${lunesDe(hoy)}T00:00:00Z`);
  const semana = Math.floor(lunes / (7 * 24 * 60 * 60 * 1000));
  return [config.juegos[semana % config.juegos.length]!];
}

// ---------------------------------------------------------------------------
// Cupones
// ---------------------------------------------------------------------------

/** Letras sin confusiones (sin 0/O ni 1/I/L). */
const ALFABETO_CUPON = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Código de cupón: "BAR-K7Q2" (el prefijo es el del negocio). */
export function codigoCupon(prefijo: string, azar: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 4; i += 1) s += ALFABETO_CUPON[Math.floor(azar() * ALFABETO_CUPON.length)];
  return `${prefijo}-${s}`;
}

export function normalizarCodigoCupon(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, '');
}

/** Nombre corto para listas públicas: «Ana L.»; sin nombre, «Cliente ·1234». */
export function nombrePublico(nombre: string | null, codigo: string): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return `Cliente ·${codigo.slice(-4)}`;
  const [primero, segundo] = partes;
  return segundo ? `${primero} ${segundo[0]!.toUpperCase()}.` : primero!;
}

// ---------------------------------------------------------------------------
// Precios del servicio
// ---------------------------------------------------------------------------

export interface PrecioPeriodo {
  /** Pesos con IVA. Null: sin precio publicado («Pregúntanos»). */
  readonly mes: number | null;
  readonly anio: number | null;
}

export interface PreciosServicio {
  readonly lite: PrecioPeriodo;
  readonly arcade: PrecioPeriodo;
}

export const PRECIOS_POR_OMISION: PreciosServicio = {
  lite: { mes: 269, anio: 2699 },
  arcade: { mes: null, anio: null },
};

const precio = (v: unknown, d: number | null): number | null =>
  v === null
    ? null
    : typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1_000_000
      ? Math.round(v)
      : d;

export function leerPrecios(json: unknown): PreciosServicio {
  const p = objeto(json);
  const d = PRECIOS_POR_OMISION;
  const periodo = (v: unknown, base: PrecioPeriodo): PrecioPeriodo => {
    const o = objeto(v);
    return { mes: precio(o.mes, base.mes), anio: precio(o.anio, base.anio) };
  };
  return { lite: periodo(p.lite, d.lite), arcade: periodo(p.arcade, d.arcade) };
}

/** "$269" (sin decimales, con separador de miles). */
export function pesos(n: number): string {
  return `$${n.toLocaleString('es-MX')}`;
}

/** Ahorro del pago anual frente a doce mensualidades, o null si no hay. */
export function ahorroAnual(p: PrecioPeriodo): number | null {
  if (p.mes === null || p.anio === null) return null;
  const ahorro = p.mes * 12 - p.anio;
  return ahorro > 0 ? ahorro : null;
}
