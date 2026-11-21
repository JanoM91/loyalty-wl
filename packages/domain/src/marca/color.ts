/**
 * Colores de la marca de un negocio y su legibilidad.
 */

export interface ColoresMarca {
  /** Fondo de la tarjeta, de los botones y de los pases. */
  readonly fondo: string;
  /** Texto sobre `fondo`. */
  readonly sobreFondo: string;
  /** Acento: estampas ganadas y premios. Rellena o bordea; no es texto. */
  readonly acento: string;
  /** Fondo de la página. */
  readonly papel: string;
  /** Texto principal sobre `papel`. */
  readonly tinta: string;
}

/** Luminancia relativa (WCAG 2.1) de un color #rrggbb. */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Contraste WCAG entre dos colores: de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Lo mínimo para que la tarjeta se pueda leer. El texto necesita 4.5:1; el
 * acento es decorativo (sellos, íconos) y con 3:1 basta.
 */
export function revisarColores(c: ColoresMarca): { errores: string[]; avisos: string[] } {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (contraste(c.sobreFondo, c.fondo) < 4.5)
    errores.push(
      'El texto de la tarjeta no se lee sobre su fondo. Elige colores con más contraste.',
    );
  if (contraste(c.tinta, c.papel) < 4.5)
    errores.push(
      'El texto no se lee sobre el fondo de la página. Elige colores con más contraste.',
    );
  if (contraste(c.acento, c.fondo) < 3)
    avisos.push(
      'El acento se distingue poco sobre el fondo de la tarjeta: los sellos se verán tenues.',
    );
  return { errores, avisos };
}

// ---------------------------------------------------------------------------
// Colores a partir del logotipo
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number];

const HEX = /^#[0-9a-f]{6}$/i;

export function deHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function aHex([r, g, b]: Rgb): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mezcla `a` con `b`: `t` = 0 da `a`, 1 da `b`. */
export function mezclar(a: string, b: string, t: number): string {
  const x = deHex(a);
  const y = deHex(b);
  return aHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

const distancia = (a: Rgb, b: Rgb) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

export interface Tono {
  readonly hex: string;
  /** Parte de la imagen que ocupa, de 0 a 1 (sin contar transparente ni blanco). */
  readonly peso: number;
}

/**
 * Los colores que más pesan en una imagen (píxeles RGBA, como los da un
 * canvas). Ignora lo transparente y el blanco de fondo; los grises cuentan
 * menos que los colores con saturación, pero un logo negro sale negro.
 * Devuelve hasta `cuantos` tonos distintos entre sí, del más al menos fuerte.
 */
export function tonosDominantes(rgba: ArrayLike<number>, cuantos = 4): Tono[] {
  const cubetas = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    if (rgba[i + 3]! < 128) continue;
    if (Math.min(r, g, b) > 232) continue; // blanco o casi
    const clave = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = cubetas.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n += 1;
    c.r += r;
    c.g += g;
    c.b += b;
    cubetas.set(clave, c);
    total += 1;
  }
  if (total === 0) return [];
  const candidatos = [...cubetas.values()]
    .map((c) => {
      const rgb: Rgb = [c.r / c.n, c.g / c.n, c.b / c.n];
      const saturacion = (Math.max(...rgb) - Math.min(...rgb)) / 255;
      return { rgb, n: c.n, puntos: c.n * (0.35 + saturacion) };
    })
    .sort((a, b) => b.puntos - a.puntos);

  // Cubetas parecidas se juntan en la más fuerte.
  const grupos: { rgb: Rgb; n: number; puntos: number }[] = [];
  for (const c of candidatos) {
    const g = grupos.find((x) => distancia(x.rgb, c.rgb) < 56);
    if (g) {
      g.n += c.n;
      g.puntos += c.puntos;
    } else grupos.push({ ...c });
  }
  return grupos
    .sort((a, b) => b.puntos - a.puntos)
    .filter((g) => g.n / total >= 0.01)
    .slice(0, cuantos)
    .map((g) => ({ hex: aHex(g.rgb), peso: g.n / total }));
}

/** El color más legible para texto sobre `fondo`: blanco o casi negro. */
function textoSobre(fondo: string): string {
  return contraste('#ffffff', fondo) >= contraste('#141414', fondo) ? '#ffffff' : '#141414';
}

/**
 * Colores de la tarjeta y la página a partir de los tonos de un logotipo: el
 * tono principal es la tarjeta y el segundo, si se distingue, el acento de
 * los sellos. Si el principal no deja leer el texto se oscurece lo necesario.
 * Null si la imagen no tiene color con qué trabajar.
 */
export function coloresDesdeTonos(tonos: readonly Pick<Tono, 'hex'>[]): ColoresMarca | null {
  const validos = tonos.map((t) => t.hex.toLowerCase()).filter((h) => HEX.test(h));
  const principal = validos[0];
  if (!principal) return null;

  // Tarjeta: el tono principal; si es tan claro que el texto apenas se lee,
  // se oscurece poco a poco hasta que el blanco se lea.
  let fondo = principal;
  for (let i = 1; i <= 8 && contraste(textoSobre(fondo), fondo) < 4.5; i += 1) {
    fondo = mezclar(principal, '#000000', i * 0.08);
  }
  const sobreFondo = textoSobre(fondo);
  if (contraste(sobreFondo, fondo) < 4.5) return null;

  // Acento: el siguiente tono que se distinga sobre la tarjeta; si no hay,
  // una versión clara (tarjeta oscura) u oscura (tarjeta clara) del principal.
  const oscura = sobreFondo === '#ffffff';
  const acento =
    validos.slice(1).find((h) => contraste(h, fondo) >= 2.2) ??
    (oscura ? mezclar(fondo, '#ffffff', 0.72) : mezclar(fondo, '#000000', 0.62));

  const papel = mezclar(fondo, '#ffffff', 0.93);
  let tinta = mezclar(fondo, '#000000', 0.72);
  if (contraste(tinta, papel) < 7) tinta = '#1a1a1a';

  const colores: ColoresMarca = { fondo, sobreFondo, acento, papel, tinta };
  return revisarColores(colores).errores.length === 0 ? colores : null;
}

/** Lee colores que llegan del navegador; null si falta alguno o no se leen bien. */
export function leerColoresMarca(json: unknown): ColoresMarca | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  const claves = ['fondo', 'sobreFondo', 'acento', 'papel', 'tinta'] as const;
  const c = {} as Record<(typeof claves)[number], string>;
  for (const k of claves) {
    const v = o[k];
    if (typeof v !== 'string' || !HEX.test(v)) return null;
    c[k] = v.toLowerCase();
  }
  return revisarColores(c).errores.length === 0 ? c : null;
}
