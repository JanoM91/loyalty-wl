/**
 * Dibujos del Arcade del club: productos del negocio y piezas de los juegos,
 * trazados en canvas con los colores de su marca.
 *
 * Cada dibujo va centrado en (0, 0) y ocupa un cuadro de lado `s`. Trazo
 * oscuro y relleno plano, como de calcomanía: se leen bien en pantallas
 * pequeñas y con cualquier combinación de colores.
 */

export interface TemaArcade {
  /** Fondo de la marca: charolas, vasos y reversos. */
  readonly f: string;
  /** Texto sobre `f`. */
  readonly s: string;
  /** Acento de la marca. */
  readonly a: string;
  /** Papel: fondo del juego. */
  readonly p: string;
  /** Tinta: textos sobre el papel. */
  readonly t: string;
  /** Inicial del negocio, en charolas y reversos. */
  readonly inicial: string;
  /** Íconos de sus productos; el primero es el estrella y vale más. */
  readonly prods: readonly string[];
  readonly palabras: readonly string[];
  readonly fuente: string;
}

type Dibujo = (c: CanvasRenderingContext2D, s: number, t: TemaArcade) => void;

export const CONTORNO = '#2a1d16';
export const PASTEL = ['#ffd59e', '#bfe6d8', '#ffc2d1', '#c9d8ff', '#ffe58a'] as const;
const TAU = Math.PI * 2;

export function rellena(c: CanvasRenderingContext2D, color: string, grosor: number): void {
  c.fillStyle = color;
  c.fill();
  c.lineWidth = grosor;
  c.strokeStyle = CONTORNO;
  c.stroke();
}

const estrellaDe = (c: CanvasRenderingContext2D, s: number, adentro: number, afuera: number) => {
  c.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = (i % 2 ? adentro : afuera) * s;
    const g = i * 0.628 - 1.57;
    c.lineTo(Math.cos(g) * r, Math.sin(g) * r);
  }
  c.closePath();
};

export const DIBUJOS: Record<string, Dibujo> = {
  taza(c, s, t) {
    c.beginPath();
    c.ellipse(0, 0.33 * s, 0.46 * s, 0.1 * s, 0, 0, TAU);
    rellena(c, '#fff', 0.04 * s);
    c.beginPath();
    c.arc(0.33 * s, 0.04 * s, 0.11 * s, -1.4, 1.4);
    c.lineWidth = 0.07 * s;
    c.strokeStyle = CONTORNO;
    c.stroke();
    c.beginPath();
    c.moveTo(-0.33 * s, -0.13 * s);
    c.lineTo(0.33 * s, -0.13 * s);
    c.quadraticCurveTo(0.31 * s, 0.3 * s, 0, 0.31 * s);
    c.quadraticCurveTo(-0.31 * s, 0.3 * s, -0.33 * s, -0.13 * s);
    rellena(c, t.a, 0.04 * s);
    c.beginPath();
    c.ellipse(0, -0.13 * s, 0.33 * s, 0.07 * s, 0, 0, TAU);
    rellena(c, '#6b3e1f', 0.04 * s);
    c.strokeStyle = '#fff';
    c.lineWidth = 0.04 * s;
    for (const x of [-0.1, 0.08]) {
      c.beginPath();
      c.moveTo(x * s, -0.24 * s);
      c.bezierCurveTo((x - 0.08) * s, -0.32 * s, (x + 0.08) * s, -0.38 * s, x * s, -0.47 * s);
      c.stroke();
    }
  },
  concha(c, s) {
    c.beginPath();
    c.moveTo(-0.44 * s, 0.2 * s);
    c.bezierCurveTo(-0.44 * s, -0.44 * s, 0.44 * s, -0.44 * s, 0.44 * s, 0.2 * s);
    c.closePath();
    rellena(c, '#e9a564', 0.04 * s);
    c.save();
    c.beginPath();
    c.moveTo(-0.38 * s, 0.1 * s);
    c.bezierCurveTo(-0.38 * s, -0.38 * s, 0.38 * s, -0.38 * s, 0.38 * s, 0.1 * s);
    c.closePath();
    c.fillStyle = '#fff1c9';
    c.fill();
    c.clip();
    c.strokeStyle = '#e8c77e';
    c.lineWidth = 0.035 * s;
    for (let i = -3; i <= 3; i += 1) {
      c.beginPath();
      c.moveTo(i * 0.13 * s, 0.15 * s);
      c.quadraticCurveTo(i * 0.06 * s, -0.2 * s, 0, -0.42 * s);
      c.stroke();
    }
    for (let r = 0.12; r < 0.5; r += 0.12) {
      c.beginPath();
      c.arc(0, 0.2 * s, r * s, Math.PI, 0);
      c.stroke();
    }
    c.restore();
  },
  croissant(c, s) {
    const partes: [number, number, number][] = [
      [-0.36, 0.12, 0.11],
      [-0.2, -0.04, 0.15],
      [0, -0.1, 0.19],
      [0.2, -0.04, 0.15],
      [0.36, 0.12, 0.11],
    ];
    for (const [x, y, r] of partes) {
      c.beginPath();
      c.ellipse(x * s, y * s, r * s, r * 1.15 * s, x * 0.9, 0, TAU);
      rellena(c, '#e39b3c', 0.035 * s);
    }
    c.strokeStyle = '#b76b1e';
    c.lineWidth = 0.03 * s;
    for (const [x, y, r] of partes.slice(1, 4)) {
      c.beginPath();
      c.arc(x * s, (y + 0.06) * s, r * 0.6 * s, 3.6, 5.8);
      c.stroke();
    }
  },
  grano(c, s) {
    c.save();
    c.rotate(-0.5);
    c.beginPath();
    c.ellipse(0, 0, 0.27 * s, 0.37 * s, 0, 0, TAU);
    rellena(c, '#7a4524', 0.04 * s);
    c.beginPath();
    c.moveTo(0, -0.33 * s);
    c.bezierCurveTo(-0.14 * s, -0.1 * s, 0.14 * s, 0.1 * s, 0, 0.33 * s);
    c.lineWidth = 0.045 * s;
    c.strokeStyle = '#3a1f0f';
    c.stroke();
    c.restore();
  },
  tijeras(c, s, t) {
    c.lineCap = 'round';
    for (const k of [-1, 1]) {
      c.beginPath();
      c.moveTo(k * 0.08 * s, 0.08 * s);
      c.lineTo(-k * 0.2 * s, -0.44 * s);
      c.lineWidth = 0.13 * s;
      c.strokeStyle = CONTORNO;
      c.stroke();
      c.lineWidth = 0.07 * s;
      c.strokeStyle = '#d9e0e5';
      c.stroke();
    }
    for (const k of [-1, 1]) {
      c.beginPath();
      c.arc(k * 0.2 * s, 0.26 * s, 0.13 * s, 0, TAU);
      c.lineWidth = 0.12 * s;
      c.strokeStyle = CONTORNO;
      c.stroke();
      c.lineWidth = 0.07 * s;
      c.strokeStyle = t.a;
      c.stroke();
    }
    c.beginPath();
    c.arc(0, -0.02 * s, 0.05 * s, 0, TAU);
    rellena(c, '#fff', 0.025 * s);
    c.lineCap = 'butt';
  },
  peine(c, s, t) {
    c.beginPath();
    c.roundRect(-0.42 * s, -0.24 * s, 0.84 * s, 0.16 * s, 0.05 * s);
    rellena(c, t.a, 0.04 * s);
    for (let i = 0; i < 10; i += 1) {
      c.beginPath();
      c.roundRect(
        (-0.39 + i * 0.081) * s,
        -0.09 * s,
        0.045 * s,
        (i % 2 ? 0.3 : 0.38) * s,
        0.02 * s,
      );
      rellena(c, t.a, 0.025 * s);
    }
  },
  navaja(c, s) {
    c.save();
    c.rotate(-0.55);
    c.beginPath();
    c.roundRect(-0.46 * s, -0.07 * s, 0.46 * s, 0.15 * s, 0.06 * s);
    rellena(c, '#6b3e22', 0.04 * s);
    c.beginPath();
    c.moveTo(0, -0.09 * s);
    c.lineTo(0.42 * s, -0.13 * s);
    c.quadraticCurveTo(0.5 * s, -0.02 * s, 0.42 * s, 0.08 * s);
    c.lineTo(0, 0.08 * s);
    c.closePath();
    rellena(c, '#dfe6ea', 0.04 * s);
    c.beginPath();
    c.moveTo(0.05 * s, -0.05 * s);
    c.lineTo(0.38 * s, -0.08 * s);
    c.lineWidth = 0.025 * s;
    c.strokeStyle = '#fff';
    c.stroke();
    c.restore();
  },
  brocha(c, s, t) {
    c.beginPath();
    c.roundRect(-0.1 * s, 0.04 * s, 0.2 * s, 0.4 * s, 0.06 * s);
    rellena(c, t.a, 0.04 * s);
    c.beginPath();
    c.rect(-0.14 * s, -0.03 * s, 0.28 * s, 0.09 * s);
    rellena(c, '#cfd6db', 0.035 * s);
    c.beginPath();
    c.moveTo(-0.17 * s, -0.03 * s);
    c.bezierCurveTo(-0.26 * s, -0.3 * s, -0.08 * s, -0.48 * s, 0, -0.48 * s);
    c.bezierCurveTo(0.08 * s, -0.48 * s, 0.26 * s, -0.3 * s, 0.17 * s, -0.03 * s);
    c.closePath();
    rellena(c, '#fff', 0.04 * s);
    c.fillStyle = '#e3eef2';
    for (const [x, y] of [
      [-0.06, -0.2],
      [0.07, -0.3],
      [0.04, -0.12],
    ] as const) {
      c.beginPath();
      c.arc(x * s, y * s, 0.04 * s, 0, TAU);
      c.fill();
    }
  },
  esmalte(c, s, t) {
    c.beginPath();
    c.roundRect(-0.09 * s, -0.47 * s, 0.18 * s, 0.27 * s, 0.04 * s);
    rellena(c, '#2b2b2b', 0.035 * s);
    c.beginPath();
    c.roundRect(-0.25 * s, -0.2 * s, 0.5 * s, 0.62 * s, 0.14 * s);
    rellena(c, t.f, 0.04 * s);
    c.beginPath();
    c.roundRect(-0.17 * s, -0.1 * s, 0.07 * s, 0.34 * s, 0.04 * s);
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.fill();
  },
  lima(c, s) {
    c.save();
    c.rotate(0.75);
    c.beginPath();
    c.roundRect(-0.48 * s, -0.09 * s, 0.96 * s, 0.18 * s, 0.09 * s);
    rellena(c, '#f4a3b8', 0.04 * s);
    c.fillStyle = '#d97a93';
    for (let i = -4; i <= 4; i += 1) {
      c.beginPath();
      c.arc(i * 0.09 * s, (i % 2 ? 0.03 : -0.03) * s, 0.018 * s, 0, TAU);
      c.fill();
    }
    c.restore();
  },
  gema(c, s) {
    c.beginPath();
    c.moveTo(-0.42 * s, -0.1 * s);
    c.lineTo(-0.22 * s, -0.33 * s);
    c.lineTo(0.22 * s, -0.33 * s);
    c.lineTo(0.42 * s, -0.1 * s);
    c.lineTo(0, 0.42 * s);
    c.closePath();
    rellena(c, '#7fd8ea', 0.04 * s);
    c.beginPath();
    c.moveTo(-0.42 * s, -0.1 * s);
    c.lineTo(0.42 * s, -0.1 * s);
    c.moveTo(-0.12 * s, -0.33 * s);
    c.lineTo(-0.18 * s, -0.1 * s);
    c.lineTo(0, 0.42 * s);
    c.lineTo(0.18 * s, -0.1 * s);
    c.lineTo(0.12 * s, -0.33 * s);
    c.lineWidth = 0.03 * s;
    c.strokeStyle = CONTORNO;
    c.stroke();
  },
  flor(c, s, t) {
    for (let i = 0; i < 5; i += 1) {
      const g = i * 1.2566 - 1.57;
      c.beginPath();
      c.ellipse(
        Math.cos(g) * 0.23 * s,
        Math.sin(g) * 0.23 * s,
        0.17 * s,
        0.21 * s,
        g + 1.57,
        0,
        TAU,
      );
      rellena(c, '#ff9bb5', 0.035 * s);
    }
    c.beginPath();
    c.arc(0, 0, 0.13 * s, 0, TAU);
    rellena(c, t.a, 0.035 * s);
  },
  regalo(c, s, t) {
    c.beginPath();
    c.roundRect(-0.36 * s, -0.08 * s, 0.72 * s, 0.5 * s, 0.05 * s);
    rellena(c, t.a, 0.04 * s);
    for (const k of [-1, 1]) {
      c.beginPath();
      c.ellipse(k * 0.14 * s, -0.31 * s, 0.15 * s, 0.08 * s, k * 0.45, 0, TAU);
      rellena(c, t.f, 0.035 * s);
    }
    c.beginPath();
    c.roundRect(-0.42 * s, -0.24 * s, 0.84 * s, 0.17 * s, 0.04 * s);
    rellena(c, t.a, 0.04 * s);
    c.beginPath();
    c.rect(-0.07 * s, -0.24 * s, 0.14 * s, 0.66 * s);
    rellena(c, t.f, 0.03 * s);
  },
  bolsa(c, s, t) {
    c.beginPath();
    c.arc(0, -0.2 * s, 0.16 * s, Math.PI, 0);
    c.lineWidth = 0.07 * s;
    c.strokeStyle = CONTORNO;
    c.stroke();
    c.beginPath();
    c.moveTo(-0.33 * s, -0.2 * s);
    c.lineTo(0.33 * s, -0.2 * s);
    c.lineTo(0.4 * s, 0.42 * s);
    c.lineTo(-0.4 * s, 0.42 * s);
    c.closePath();
    rellena(c, t.f, 0.04 * s);
    c.fillStyle = t.s;
    c.font = `800 ${0.34 * s}px ${t.fuente}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(t.inicial, 0, 0.13 * s);
  },
  nube(c, s) {
    c.beginPath();
    for (const [x, y, r] of [
      [-0.22, -0.02, 0.17],
      [0, -0.14, 0.22],
      [0.22, -0.02, 0.17],
    ] as const) {
      c.moveTo((x + r) * s, y * s);
      c.arc(x * s, y * s, r * s, 0, TAU);
    }
    c.rect(-0.39 * s, -0.02 * s, 0.78 * s, 0.15 * s);
    rellena(c, '#677080', 0.04 * s);
    c.beginPath();
    c.moveTo(0.02 * s, 0.06 * s);
    c.lineTo(-0.12 * s, 0.3 * s);
    c.lineTo(0, 0.28 * s);
    c.lineTo(-0.06 * s, 0.48 * s);
    c.lineTo(0.14 * s, 0.2 * s);
    c.lineTo(0.02 * s, 0.22 * s);
    c.closePath();
    rellena(c, '#ffd84d', 0.03 * s);
  },
  sello(c, s) {
    c.beginPath();
    c.arc(0, 0, 0.4 * s, 0, TAU);
    rellena(c, '#f5c542', 0.045 * s);
    c.beginPath();
    c.arc(0, 0, 0.3 * s, 0, TAU);
    c.lineWidth = 0.03 * s;
    c.strokeStyle = '#c8941a';
    c.stroke();
    estrellaDe(c, s, 0.09, 0.21);
    c.fillStyle = '#fff';
    c.fill();
  },
  corazon(c, s) {
    c.beginPath();
    c.moveTo(0, 0.34 * s);
    c.bezierCurveTo(-0.55 * s, -0.02 * s, -0.28 * s, -0.5 * s, 0, -0.18 * s);
    c.bezierCurveTo(0.28 * s, -0.5 * s, 0.55 * s, -0.02 * s, 0, 0.34 * s);
    rellena(c, '#ff6b81', 0.04 * s);
  },
  estrella(c, s) {
    estrellaDe(c, s, 0.19, 0.44);
    rellena(c, '#ffd84d', 0.04 * s);
  },
  vaso(c, s, t) {
    c.beginPath();
    c.moveTo(-0.26 * s, -0.36 * s);
    c.lineTo(0.26 * s, -0.36 * s);
    c.lineTo(0.38 * s, 0.34 * s);
    c.lineTo(-0.38 * s, 0.34 * s);
    c.closePath();
    rellena(c, t.f, 0.04 * s);
    c.beginPath();
    c.rect(-0.39 * s, 0.2 * s, 0.78 * s, 0.12 * s);
    rellena(c, t.a, 0.03 * s);
  },
  cartas(c, s, t) {
    c.save();
    c.rotate(-0.25);
    c.beginPath();
    c.roundRect(-0.34 * s, -0.4 * s, 0.48 * s, 0.66 * s, 0.08 * s);
    rellena(c, t.f, 0.035 * s);
    c.restore();
    c.save();
    c.rotate(0.18);
    c.beginPath();
    c.roundRect(-0.12 * s, -0.36 * s, 0.48 * s, 0.66 * s, 0.08 * s);
    rellena(c, '#fff', 0.035 * s);
    c.translate(0.12 * s, -0.03 * s);
    DIBUJOS.estrella!(c, 0.36 * s, t);
    c.restore();
  },
  hoyo(c, s, t) {
    c.save();
    c.translate(0, -0.08 * s);
    dibujo(t.prods[0] ?? 'estrella')(c, 0.62 * s, t);
    c.restore();
    c.beginPath();
    c.ellipse(0, 0.26 * s, 0.44 * s, 0.14 * s, 0, 0, Math.PI);
    c.lineTo(-0.44 * s, 0.26 * s);
    rellena(c, t.f, 0.035 * s);
  },
  bloques(c, s) {
    for (const [x, y, k] of [
      [-1, -1, 0],
      [1, -1, 1],
      [-1, 1, 2],
      [1, 1, 0],
    ] as const) {
      c.beginPath();
      c.roundRect((x * 0.22 - 0.2) * s, (y * 0.22 - 0.2) * s, 0.4 * s, 0.4 * s, 0.08 * s);
      rellena(c, PASTEL[k], 0.035 * s);
    }
  },
  letras(c, s, t) {
    c.beginPath();
    c.roundRect(-0.42 * s, -0.42 * s, 0.84 * s, 0.84 * s, 0.1 * s);
    rellena(c, '#fff', 0.035 * s);
    c.fillStyle = CONTORNO;
    c.font = `800 ${0.26 * s}px ${t.fuente}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    ['SO', 'PA'].forEach((r, j) =>
      [...r].forEach((l, i) => c.fillText(l, (i - 0.5) * 0.36 * s, (j - 0.5) * 0.36 * s)),
    );
    c.beginPath();
    c.roundRect(-0.36 * s, -0.3 * s, 0.72 * s, 0.22 * s, 0.11 * s);
    c.lineWidth = 0.04 * s;
    c.strokeStyle = t.a;
    c.stroke();
  },
};

/** El dibujo por nombre; uno genérico si no existe. */
export function dibujo(nombre: string): Dibujo {
  return DIBUJOS[nombre] ?? DIBUJOS.estrella!;
}

/** Pinta un dibujo en un canvas pequeño (botones del selector de juego). */
export function miniatura(cv: HTMLCanvasElement, nombre: string, t: TemaArcade): void {
  const r = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 44;
  cv.width = cv.height = w * r;
  const c = cv.getContext('2d');
  if (!c) return;
  // El desplazamiento de setTransform va en pixeles del canvas, no en los de CSS.
  c.setTransform(r, 0, 0, r, (w * r) / 2, (w * r) / 2);
  dibujo(nombre)(c, w * 0.9, t);
}
