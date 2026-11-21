/**
 * Motor de los juegos del Arcade del club: un canvas, un ciclo de cuadros y
 * seis juegos de habilidad que suben de nivel.
 *
 * El motor solo mide y pinta. Quién puede jugar, cuántas veces y qué gana lo
 * decide el servidor (`iniciarPartida` y `terminarPartida`), que además mide
 * cuánto duró la partida y descarta puntajes imposibles.
 *
 * El azar sale de la semilla que da el servidor al abrir la partida, no de
 * `Math.random`: así una partida se puede repetir igual si hace falta revisarla.
 */

import { CONTORNO, PASTEL, dibujo, rellena, type TemaArcade } from './dibujos';

export const JUGABLES = ['atrapa', 'memorama', 'asoma', 'donde', 'junta', 'sopa'] as const;
export type IdJugable = (typeof JUGABLES)[number];

export function esJugable(id: string): id is IdJugable {
  return (JUGABLES as readonly string[]).includes(id);
}

export interface InfoJuego {
  /** Dibujo del botón; `producto` usa el producto estrella del negocio. */
  readonly icono: string;
  readonly como: string;
  readonly nivel: string;
}

export const INFO_JUEGOS: Record<IdJugable, InfoJuego> = {
  atrapa: {
    icono: 'producto',
    como: 'Mueve la charola y atrapa lo que cae. Esquiva las nubes.',
    nivel: 'Cada 150 puntos cae más rápido y más seguido.',
  },
  memorama: {
    icono: 'cartas',
    como: 'Voltea dos cartas; si son iguales se quedan. Encuentra todos los pares.',
    nivel: 'Cada tablero resuelto suma cartas y 15 segundos.',
  },
  asoma: {
    icono: 'hoyo',
    como: 'Toca cada producto que se asome antes de que se esconda. No toques las nubes.',
    nivel: 'Cada 120 puntos se asoman más rápido y duran menos.',
  },
  donde: {
    icono: 'vaso',
    como: 'Mira bajo qué vaso queda el producto, sigue los vasos y toca el correcto.',
    nivel: 'Cada acierto: más movimientos y más rápidos; desde el nivel 3, más vasos.',
  },
  junta: {
    icono: 'bloques',
    como: 'Toca grupos de 2 o más iguales para quitarlos. Los grupos grandes valen mucho más.',
    nivel: 'Llega a la meta antes de quedarte sin jugadas; desde el nivel 3 hay un producto más.',
  },
  sopa: {
    icono: 'letras',
    como: 'Desliza sobre las letras para marcar cada palabra de la lista.',
    nivel: 'Cada sopa resuelta agranda la cuadrícula, suma diagonales y 30 segundos.',
  },
};

export interface Marcador {
  readonly puntos: number;
  readonly nivel: number;
  /** Segundos que quedan, en los juegos con reloj. */
  readonly segundos: number | null;
  /** Vidas que quedan, en los juegos con vidas. */
  readonly vidas: number | null;
  readonly maxVidas: number;
}

export interface OpcionesMotor {
  readonly canvas: HTMLCanvasElement;
  readonly tema: TemaArcade;
  readonly juego: IdJugable;
  readonly semilla: number;
  /** Quien pidió menos movimiento: sin confeti ni sacudidas. */
  readonly sinMovimiento: boolean;
  readonly alMarcador: (m: Marcador) => void;
  readonly alTerminar: (r: { readonly puntos: number; readonly nivel: number }) => void;
}

export interface Motor {
  abajo(x: number, y: number): void;
  mueve(x: number, y: number, presionado: boolean): void;
  arriba(x: number, y: number): void;
  tecla(lado: 'izq' | 'der', presionada: boolean): void;
  /** Termina la partida ya y reporta los puntos. */
  terminar(): void;
  /** Suelta el canvas sin reportar nada (la pantalla se cerró). */
  detener(): void;
}

/** Generador de números entre 0 y 1 a partir de una semilla (mulberry32). */
export function azarCon(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const NUBLADO = '#677080';
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const unicos = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** El fondo del juego: papel de la marca con burbujas de su acento. */
export function pintarFondo(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  t: TemaArcade,
): void {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gr = c.createLinearGradient(0, 0, 0, H || 1);
  gr.addColorStop(0, t.p);
  gr.addColorStop(1, '#ffffff');
  c.fillStyle = gr;
  c.fillRect(0, 0, W, H);
  c.fillStyle = `${t.a}30`;
  for (let i = 0; i < 6; i += 1) {
    c.beginPath();
    c.arc((i * 97 + 30) % (W || 1), ((i * 173) % ((H || 1) * 0.7)) + 50, 16 + i * 4, 0, TAU);
    c.fill();
  }
}

// ---------------------------------------------------------------------------
// Lo que cada juego puede usar del motor
// ---------------------------------------------------------------------------

interface Estado {
  pts: number;
  nivel: number;
  vidas: number | null;
  max: number;
  /** Segundos restantes o null si el juego no tiene reloj. */
  t: number | null;
  /** Cuenta regresiva para cerrar la partida; 0 mientras se juega. */
  fin: number;
}

interface Contexto {
  readonly c: CanvasRenderingContext2D;
  readonly W: number;
  readonly H: number;
  readonly e: Estado;
  readonly tema: TemaArcade;
  readonly teclas: { izq: boolean; der: boolean };
  azar(): number;
  rnd(a: number, b: number): number;
  ri(n: number): number;
  baraja<T>(xs: readonly T[]): T[];
  icono(k: string, x: number, y: number, z: number, r?: number): void;
  suma(v: number, x: number, y: number): void;
  herida(x: number, y: number): void;
  sube(): void;
  flota(x: number, y: number, txt: string, col?: string): void;
  rr(x: number, y: number, w: number, h: number, r: number, fill: string, lw?: number): void;
  texto(txt: string, x: number, y: number, tam: number, col?: string, peso?: number): void;
  charola(x: number, y: number, w: number): void;
  /** Producto estrella: vale más. */
  p0(): string;
  /** Otro producto del negocio al azar. */
  px(): string;
}

interface Juego {
  paso(dt: number): void;
  dib(): void;
  abajo?(x: number, y: number): void;
  mueve?(x: number, y: number, presionado: boolean): void;
  arriba?(x: number, y: number): void;
}

// ---------------------------------------------------------------------------
// Los juegos
// ---------------------------------------------------------------------------

function atrapa(m: Contexto): Juego {
  type Cae = { k: string; x: number; y: number; z: number; v: number; r: number; w: number };
  let cae: Cae[] = [];
  let sig = 0;
  let x = m.W / 2;
  const ancho = () => Math.max(70, m.W * 0.26);
  return {
    paso(dt) {
      const ty = m.H * 0.88;
      const tw = ancho();
      sig -= dt;
      if (sig <= 0) {
        sig = Math.max(0.3, 0.68 - 0.05 * m.e.nivel);
        const r = m.azar();
        const z = Math.max(42, m.W * 0.15);
        cae.push({
          k: r < 0.15 + 0.02 * m.e.nivel ? 'nube' : r < 0.23 ? 'sello' : r < 0.4 ? m.p0() : m.px(),
          x: m.rnd(z / 2, m.W - z / 2),
          y: -z,
          z,
          v: m.H * (0.24 + 0.05 * m.e.nivel) * m.rnd(0.85, 1.15),
          r: m.rnd(-0.3, 0.3),
          w: m.rnd(-1, 1),
        });
      }
      if (m.teclas.izq) x -= m.W * 1.1 * dt;
      if (m.teclas.der) x += m.W * 1.1 * dt;
      x = cl(x, tw / 2, m.W - tw / 2);
      cae = cae.filter((o) => {
        o.y += o.v * dt;
        o.r += o.w * dt;
        if (
          o.y > ty - o.z * 0.4 &&
          o.y < ty + o.z * 0.2 &&
          Math.abs(o.x - x) < tw / 2 + o.z * 0.2
        ) {
          if (o.k === 'nube') m.herida(o.x, ty - 30);
          else m.suma(o.k === m.p0() ? 25 : o.k === 'sello' ? 15 : 10, o.x, ty - 30);
          return false;
        }
        return o.y <= m.H + o.z;
      });
      if (m.e.pts >= m.e.nivel * 150) m.sube();
    },
    dib() {
      for (const o of cae) m.icono(o.k, o.x, o.y, o.z, o.r);
      m.charola(x, m.H * 0.88, ancho());
    },
    mueve(nx) {
      x = nx;
    },
    abajo(nx) {
      x = nx;
    },
  };
}

function memorama(m: Contexto): Juego {
  m.e.vidas = null;
  m.e.t = 60;
  type Carta = {
    k: string;
    x: number;
    y: number;
    w: number;
    h: number;
    a: number;
    ab: boolean;
    ok: boolean;
  };
  let cartas: Carta[] = [];
  let sel: Carta[] = [];
  let bloqueo = 0;
  let prox = 0;
  const tablero = () => {
    const pares = [3, 4, 6, 8][Math.min(m.e.nivel - 1, 3)]!;
    const cols = pares <= 3 ? 3 : 4;
    const rows = (pares * 2) / cols;
    const pool = unicos([
      ...m.tema.prods,
      'sello',
      'corazon',
      'estrella',
      'nube',
      'regalo',
      'bolsa',
    ]).slice(0, pares);
    const ks = m.baraja([...pool, ...pool]);
    const top = 62;
    const gap = 10;
    const aw = m.W - 28;
    const ah = m.H - top - 16;
    const ch = Math.min((ah - (rows - 1) * gap) / rows, (aw - (cols - 1) * gap) / cols / 0.74);
    const cw = ch * 0.74;
    const ox = (m.W - (cols * cw + (cols - 1) * gap)) / 2;
    const oy = top + (ah - (rows * ch + (rows - 1) * gap)) / 2;
    cartas = ks.map((k, i) => ({
      k,
      x: ox + (i % cols) * (cw + gap),
      y: oy + Math.floor(i / cols) * (ch + gap),
      w: cw,
      h: ch,
      a: 0,
      ab: false,
      ok: false,
    }));
    sel = [];
    bloqueo = 0;
    prox = 0;
  };
  tablero();
  return {
    paso(dt) {
      for (const k of cartas) k.a += ((k.ab || k.ok ? 1 : 0) - k.a) * Math.min(1, dt * 12);
      if (bloqueo > 0) {
        bloqueo -= dt;
        if (bloqueo <= 0) {
          for (const k of cartas) if (!k.ok) k.ab = false;
          sel = [];
        }
      }
      if (prox > 0) {
        prox -= dt;
        if (prox <= 0) tablero();
      }
    },
    dib() {
      const t = m.tema;
      const c = m.c;
      for (const k of cartas) {
        const sx = Math.max(0.04, Math.abs(Math.cos(Math.PI * k.a)));
        c.save();
        c.translate(k.x + k.w / 2, k.y + k.h / 2);
        c.scale(sx, 1);
        if (k.a < 0.5) {
          m.rr(-k.w / 2, -k.h / 2, k.w, k.h, 12, t.f, 2.5);
          c.fillStyle = t.a;
          c.font = `800 ${k.w * 0.42}px ${t.fuente}`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(t.inicial, 0, 2);
        } else {
          m.rr(-k.w / 2, -k.h / 2, k.w, k.h, 12, k.ok ? '#fffbe9' : '#fff', k.ok ? 4 : 2.5);
          dibujo(k.k)(c, k.w * 0.7, t);
        }
        c.restore();
      }
    },
    abajo(x, y) {
      if (bloqueo > 0 || prox > 0) return;
      const k = cartas.find((k) => x > k.x && x < k.x + k.w && y > k.y && y < k.y + k.h);
      if (!k || k.ab || k.ok) return;
      k.ab = true;
      sel.push(k);
      const [a, b] = sel;
      if (!a || !b) return;
      if (a.k === b.k) {
        a.ok = b.ok = true;
        sel = [];
        m.suma(20, b.x + b.w / 2, b.y);
        if (cartas.every((k) => k.ok)) {
          m.suma(50 * m.e.nivel, m.W / 2, m.H / 2);
          m.e.t = (m.e.t ?? 0) + 15;
          m.sube();
          prox = 0.9;
        }
      } else bloqueo = 0.8;
    },
  };
}

function asoma(m: Contexto): Juego {
  m.e.t = 60;
  const ts = Math.min(m.W / 3.3, (m.H - 130) / 3.3);
  const hoyos = Array.from({ length: 9 }, (_, i) => ({
    x: m.W / 2 + ((i % 3) - 1) * ts,
    y: m.H * 0.5 + (Math.floor(i / 3) - 1) * ts * 1.05,
    k: null as string | null,
    t: 0,
    d: 0,
  }));
  let sig = 0.5;
  return {
    paso(dt) {
      sig -= dt;
      if (sig <= 0) {
        sig = Math.max(0.3, 0.82 - 0.07 * m.e.nivel);
        const libres = hoyos.filter((o) => !o.k);
        const o = libres[m.ri(libres.length)];
        if (o) {
          const r = m.azar();
          o.k = r < 0.2 ? 'nube' : r < 0.38 ? m.p0() : m.px();
          o.t = 0;
          o.d = Math.max(0.6, 1.35 - 0.09 * m.e.nivel);
        }
      }
      for (const o of hoyos)
        if (o.k) {
          o.t += dt;
          if (o.t > o.d) o.k = null;
        }
      if (m.e.pts >= m.e.nivel * 120) m.sube();
    },
    dib() {
      const t = m.tema;
      const c = m.c;
      for (const o of hoyos) {
        const by = o.y + ts * 0.3;
        c.beginPath();
        c.ellipse(o.x, by, ts * 0.4, ts * 0.13, 0, 0, TAU);
        c.fillStyle = 'rgba(0,0,0,.25)';
        c.fill();
        if (o.k) {
          const p = cl(Math.min(o.t / 0.12, (o.d - o.t) / 0.12), 0, 1);
          c.save();
          c.beginPath();
          c.rect(o.x - ts / 2, by - ts, ts, ts);
          c.clip();
          m.icono(o.k, o.x, by + ts * 0.3 - p * ts * 0.62, ts * 0.6);
          c.restore();
        }
        c.beginPath();
        c.ellipse(o.x, by, ts * 0.42, ts * 0.14, 0, 0, Math.PI);
        c.lineTo(o.x - ts * 0.42, by);
        rellena(c, t.f, 2.5);
      }
    },
    abajo(x, y) {
      for (const o of hoyos)
        if (o.k && Math.hypot(x - o.x, y - o.y) < ts * 0.45) {
          if (o.k === 'nube') m.herida(o.x, o.y - 30);
          else m.suma(o.k === m.p0() ? 25 : 10, o.x, o.y - 30);
          o.k = null;
          break;
        }
    },
  };
}

function donde(m: Contexto): Juego {
  type Fase = 'ver' | 'bajar' | 'rev' | 'elige' | 'alza';
  const ronda = () => {
    const n = m.e.nivel >= 6 ? 5 : m.e.nivel >= 3 ? 4 : 3;
    const cambios: [number, number][] = [];
    const k = Math.min(20, 3 + 2 * m.e.nivel);
    for (let i = 0; i < k; i += 1) {
      const a = m.ri(n);
      let b = m.ri(n - 1);
      if (b >= a) b += 1;
      cambios.push([a, b]);
    }
    return {
      n,
      /** Lugar de cada vaso. */
      pos: Array.from({ length: n }, (_, i) => i),
      premio: m.ri(n),
      cambios,
      si: 0,
      f: 'ver' as Fase,
      tf: 0,
      dur: Math.max(0.16, 0.42 - 0.03 * m.e.nivel),
      eleg: -1,
    };
  };
  let s = ronda();
  const lugar = (k: number) => {
    const gap = Math.min(m.W / (s.n + 0.4), m.W * 0.3);
    return m.W / 2 + (k - (s.n - 1) / 2) * gap;
  };
  const tamVaso = () => Math.min(m.W / (s.n + 0.6), m.W * 0.27);
  return {
    paso(dt) {
      s.tf += dt;
      if (s.f === 'ver' && s.tf > 1.3) {
        s.f = 'bajar';
        s.tf = 0;
      } else if (s.f === 'bajar' && s.tf > 0.35) {
        s.f = 'rev';
        s.tf = 0;
      } else if (s.f === 'rev' && s.tf >= s.dur) {
        const [a, b] = s.cambios[s.si]!;
        const ca = s.pos.indexOf(a);
        const cb = s.pos.indexOf(b);
        s.pos[ca] = b;
        s.pos[cb] = a;
        s.si += 1;
        s.tf = 0;
        if (s.si >= s.cambios.length) s.f = 'elige';
      } else if (s.f === 'alza' && s.tf > 1.3 && !m.e.fin) s = ronda();
    },
    dib() {
      const t = m.tema;
      const base = m.H * 0.62;
      const cw = tamVaso();
      m.c.fillStyle = t.f;
      m.c.fillRect(0, base + 4, m.W, m.H - base);
      const aviso =
        s.f === 'elige'
          ? '¿Dónde quedó?'
          : s.f === 'ver'
            ? 'Fíjate bien'
            : s.f === 'alza'
              ? ''
              : 'Síguelo…';
      if (aviso) m.texto(aviso, m.W / 2, m.H * 0.2, 22);
      for (let i = 0; i < s.n; i += 1) {
        const pi = s.pos[i]!;
        let x = lugar(pi);
        let y = base;
        let alza = 0;
        if (s.f === 'rev') {
          const [a, b] = s.cambios[s.si]!;
          const p = Math.min(1, s.tf / s.dur);
          const e = p * p * (3 - 2 * p);
          if (pi === a) {
            x = lugar(a) + (lugar(b) - lugar(a)) * e;
            y = base - Math.sin(Math.PI * e) * m.H * 0.05;
          } else if (pi === b) {
            x = lugar(b) + (lugar(a) - lugar(b)) * e;
            y = base + Math.sin(Math.PI * e) * m.H * 0.02;
          }
        }
        if (s.f === 'ver' && i === s.premio) alza = Math.min(1, s.tf * 4) * cw * 0.9;
        if (s.f === 'bajar' && i === s.premio) alza = Math.max(0, 1 - s.tf / 0.35) * cw * 0.9;
        if (s.f === 'alza' && (i === s.premio || i === s.eleg))
          alza = Math.min(1, s.tf * 4) * cw * 0.9;
        if (i === s.premio && alza > 0) m.icono(m.p0(), x, y - cw * 0.3, cw * 0.55);
        m.icono('vaso', x, y - cw * 0.42 - alza, cw);
      }
    },
    abajo(x, y) {
      if (s.f !== 'elige') return;
      const base = m.H * 0.62;
      const cw = tamVaso();
      if (y < base - cw * 1.2 || y > base + 24) return;
      let mejor = -1;
      let d = 1e9;
      for (let i = 0; i < s.n; i += 1) {
        const dd = Math.abs(lugar(s.pos[i]!) - x);
        if (dd < d) {
          d = dd;
          mejor = i;
        }
      }
      if (d > cw * 0.6) return;
      s.eleg = mejor;
      s.f = 'alza';
      s.tf = 0;
      if (mejor === s.premio) {
        m.suma(30 * m.e.nivel, x, base - cw * 1.3);
        m.sube();
      } else m.herida(x, base - cw * 1.3);
    },
  };
}

function junta(m: Contexto): Juego {
  m.e.vidas = null;
  const C = 6;
  const R = 8;
  const tablero = () => {
    const tipos = unicos([...m.tema.prods, 'sello', 'estrella', 'corazon']);
    const nt = Math.min(m.e.nivel < 3 ? 4 : 5, tipos.length);
    const ts = Math.min((m.W - 24) / C, (m.H - 110) / R);
    return {
      ts,
      tipos: tipos.slice(0, nt),
      ox: (m.W - ts * C) / 2,
      oy: m.H - 14 - ts * R,
      col: Array.from({ length: C }, () => Array.from({ length: R }, () => m.ri(nt))),
      meta: m.e.pts + 110 + 30 * m.e.nivel,
      prox: 0,
    };
  };
  let s = tablero();
  const celda = (i: number, j: number) => s.col[i]?.[j] ?? -1;
  const hayJugadas = () => {
    for (let i = 0; i < C; i += 1)
      for (let j = 0; j < R; j += 1) {
        const v = celda(i, j);
        if (v >= 0 && (celda(i + 1, j) === v || celda(i, j + 1) === v)) return true;
      }
    return false;
  };
  return {
    paso(dt) {
      if (s.prox > 0) {
        s.prox -= dt;
        if (s.prox <= 0) s = tablero();
      }
    },
    dib() {
      m.texto(`Meta: ${s.meta} pts`, m.W / 2, 58, 15);
      for (let i = 0; i < C; i += 1)
        for (let j = 0; j < R; j += 1) {
          const v = celda(i, j);
          if (v < 0) continue;
          const x = s.ox + i * s.ts;
          const y = s.oy + (R - 1 - j) * s.ts;
          m.rr(x + 2, y + 2, s.ts - 4, s.ts - 4, 10, PASTEL[v % PASTEL.length]!, 2);
          m.icono(s.tipos[v]!, x + s.ts / 2, y + s.ts / 2, s.ts * 0.66);
        }
    },
    abajo(x, y) {
      if (s.prox > 0 || m.e.fin) return;
      const i = Math.floor((x - s.ox) / s.ts);
      const j = R - 1 - Math.floor((y - s.oy) / s.ts);
      const v = celda(i, j);
      if (v < 0) return;
      const grupo: [number, number][] = [];
      const visto = new Set<number>();
      const pila: [number, number][] = [[i, j]];
      while (pila.length) {
        const [a, b] = pila.pop()!;
        const k = a * 99 + b;
        if (visto.has(k) || celda(a, b) !== v) continue;
        visto.add(k);
        grupo.push([a, b]);
        pila.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
      }
      if (grupo.length < 2) return;
      for (const [a, b] of grupo) s.col[a]![b] = -1;
      const n = grupo.length;
      m.suma(n * (n - 1) * 3, x, y - 20);
      s.col = s.col
        .map((col) => {
          const k = col.filter((q) => q >= 0);
          while (k.length < R) k.push(-1);
          return k;
        })
        .filter((col) => (col[0] ?? -1) >= 0);
      while (s.col.length < C) s.col.push(Array<number>(R).fill(-1));
      if (!hayJugadas()) {
        if (m.e.pts >= s.meta) {
          m.suma(40 * m.e.nivel, m.W / 2, m.H / 2);
          m.sube();
          s.prox = 0.9;
        } else {
          m.flota(m.W / 2, m.H * 0.4, 'Sin jugadas', NUBLADO);
          m.e.fin = 1.2;
        }
      }
    },
  };
}

function sopa(m: Contexto): Juego {
  m.e.vidas = null;
  m.e.t = 120;
  type Punto = [number, number];
  type Ficha = { w: string; ok: boolean; x: number; y: number; ancho: number };
  const fuenteFichas = `800 14px ${m.tema.fuente}`;
  const tablero = () => {
    const L = Math.min(m.e.nivel - 1, 3);
    const n = [7, 8, 9, 10][L]!;
    const cuantas = [4, 5, 6, 6][L]!;
    const dirs: Punto[] = [
      [1, 0],
      [0, 1],
    ];
    if (m.e.nivel >= 2) dirs.push([1, 1]);
    if (m.e.nivel >= 3) dirs.push([1, -1]);
    const candidatas = m.baraja(m.tema.palabras.filter((w) => [...w].length <= n));
    const mat = Array.from({ length: n }, () => Array<string>(n).fill(''));
    const puestas: string[] = [];
    for (const w of candidatas) {
      if (puestas.length >= cuantas) break;
      const ch = [...w];
      for (let intento = 0; intento < 300; intento += 1) {
        const [dx, dy] = dirs[m.ri(dirs.length)]!;
        const x = m.ri(n);
        const y = m.ri(n);
        const ex = x + dx * (ch.length - 1);
        const ey = y + dy * (ch.length - 1);
        if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
        const cabe = ch.every((l, k) => {
          const c = mat[y + dy * k]![x + dx * k];
          return !c || c === l;
        });
        if (cabe) {
          ch.forEach((l, k) => {
            mat[y + dy * k]![x + dx * k] = l;
          });
          puestas.push(w);
          break;
        }
      }
    }
    const AB = 'ABCDEFGHIJLMNOPRSTUVZ';
    for (const fila of mat)
      for (let i = 0; i < n; i += 1) if (!fila[i]) fila[i] = AB[m.ri(AB.length)]!;

    // Las palabras por encontrar van arriba, en renglones; la cuadrícula abajo.
    m.c.font = fuenteFichas;
    let fx = 14;
    let fy = 60;
    const fichas: Ficha[] = puestas.map((w) => {
      const ancho = m.c.measureText(w).width + 18;
      if (fx + ancho > m.W - 10) {
        fx = 14;
        fy += 26;
      }
      const f = { w, ok: false, x: fx, y: fy, ancho };
      fx += ancho + 6;
      return f;
    });
    const top = fy + 22;
    const cs = Math.min((m.W - 20) / n, (m.H - top - 14) / n);
    return {
      n,
      mat,
      fichas,
      cs,
      ox: (m.W - cs * n) / 2,
      oy: top + (m.H - top - 14 - cs * n) / 2,
      sel: null as { a: Punto; b: Punto } | null,
      hechas: [] as { a: Punto; b: Punto; col: string }[],
      prox: 0,
    };
  };
  let s = tablero();
  const celda = (x: number, y: number, recorta: boolean): Punto | null => {
    const i = Math.floor((x - s.ox) / s.cs);
    const j = Math.floor((y - s.oy) / s.cs);
    if (!recorta && (i < 0 || j < 0 || i >= s.n || j >= s.n)) return null;
    return [cl(i, 0, s.n - 1), cl(j, 0, s.n - 1)];
  };
  const linea = (a: Punto, b: Punto): Punto[] => {
    const dx = Math.sign(b[0] - a[0]);
    const dy = Math.sign(b[1] - a[1]);
    const k = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    return Array.from({ length: k + 1 }, (_, q) => [a[0] + dx * q, a[1] + dy * q]);
  };
  const marca = (a: Punto, b: Punto, col: string) => {
    const c = m.c;
    const p = (q: Punto) => [s.ox + (q[0] + 0.5) * s.cs, s.oy + (q[1] + 0.5) * s.cs] as const;
    const [x1, y1] = p(a);
    const [x2, y2] = p(b);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.lineWidth = s.cs * 0.78;
    c.strokeStyle = col;
    c.stroke();
    c.lineCap = 'butt';
  };
  return {
    paso(dt) {
      if (s.prox > 0) {
        s.prox -= dt;
        if (s.prox <= 0) s = tablero();
      }
    },
    dib() {
      const c = m.c;
      for (const f of s.fichas) {
        c.globalAlpha = f.ok ? 0.5 : 1;
        m.rr(f.x, f.y - 11, f.ancho, 22, 11, f.ok ? PASTEL[1] : '#fff', 1.5);
        c.font = fuenteFichas;
        c.fillStyle = CONTORNO;
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(f.w, f.x + 9, f.y + 1);
        if (f.ok) {
          c.beginPath();
          c.moveTo(f.x + 6, f.y);
          c.lineTo(f.x + f.ancho - 6, f.y);
          c.lineWidth = 2;
          c.strokeStyle = CONTORNO;
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      m.rr(s.ox - 4, s.oy - 4, s.cs * s.n + 8, s.cs * s.n + 8, 12, '#fff', 2);
      for (const h of s.hechas) marca(h.a, h.b, h.col);
      if (s.sel) marca(s.sel.a, s.sel.b, `${m.tema.a}aa`);
      c.fillStyle = CONTORNO;
      c.font = `800 ${s.cs * 0.5}px ${m.tema.fuente}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let j = 0; j < s.n; j += 1)
        for (let i = 0; i < s.n; i += 1)
          c.fillText(s.mat[j]![i]!, s.ox + (i + 0.5) * s.cs, s.oy + (j + 0.55) * s.cs);
    },
    abajo(x, y) {
      const q = celda(x, y, false);
      if (q) s.sel = { a: q, b: q };
    },
    mueve(x, y, presionado) {
      if (!presionado || !s.sel) return;
      const q = celda(x, y, true)!;
      const { a } = s.sel;
      const dx = q[0] - a[0];
      const dy = q[1] - a[1];
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax > 2 * ay) s.sel.b = [q[0], a[1]];
      else if (ay > 2 * ax) s.sel.b = [a[0], q[1]];
      else {
        const k = Math.min(ax, ay);
        s.sel.b = [a[0] + Math.sign(dx) * k, a[1] + Math.sign(dy) * k];
      }
    },
    arriba() {
      const sel = s.sel;
      s.sel = null;
      if (!sel) return;
      const tx = linea(sel.a, sel.b)
        .map(([i, j]) => s.mat[j]![i]!)
        .join('');
      const rv = [...tx].reverse().join('');
      const f = s.fichas.find((f) => !f.ok && (f.w === tx || f.w === rv));
      if (!f) return;
      f.ok = true;
      s.hechas.push({ a: sel.a, b: sel.b, col: PASTEL[s.hechas.length % PASTEL.length]! });
      m.suma(30, s.ox + (sel.b[0] + 0.5) * s.cs, s.oy + sel.b[1] * s.cs);
      if (s.fichas.every((f) => f.ok)) {
        m.suma(50 * m.e.nivel, m.W / 2, m.H / 2);
        m.e.t = (m.e.t ?? 0) + 30;
        m.sube();
        s.prox = 1;
      }
    },
  };
}

const FABRICAS: Record<IdJugable, (m: Contexto) => Juego> = {
  atrapa,
  memorama,
  asoma,
  donde,
  junta,
  sopa,
};

// ---------------------------------------------------------------------------
// El ciclo
// ---------------------------------------------------------------------------

export function crearMotor(o: OpcionesMotor): Motor {
  const { canvas, tema } = o;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Este navegador no puede dibujar el juego.');
  let W = 0;
  let H = 0;
  let dpr = 1;
  const medir = () => {
    dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  medir();
  const observador = new ResizeObserver(medir);
  observador.observe(canvas);

  const azar = azarCon(o.semilla);
  const ri = (n: number) => Math.floor(azar() * n);
  const e: Estado = { pts: 0, nivel: 1, vidas: 3, max: 3, t: null, fin: 0 };
  type Flotante = { x: number; y: number; txt: string; col: string; a: number };
  type Chispa = { x: number; y: number; vx: number; vy: number; a: number; c: string };
  let flotantes: Flotante[] = [];
  let chispas: Chispa[] = [];
  let choque = 0;
  let banner = 0;
  const teclas = { izq: false, der: false };
  const otros = tema.prods.length > 1 ? tema.prods.slice(1) : tema.prods;

  const texto = (txt: string, x: number, y: number, tam: number, col?: string, peso?: number) => {
    c.font = `${peso ?? 800} ${tam}px ${tema.fuente}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 5;
    c.strokeStyle = '#fff';
    c.strokeText(txt, x, y);
    c.fillStyle = col ?? tema.t;
    c.fillText(txt, x, y);
  };

  const m: Contexto = {
    c,
    get W() {
      return W;
    },
    get H() {
      return H;
    },
    e,
    tema,
    teclas,
    azar,
    rnd: (a, b) => a + azar() * (b - a),
    ri,
    baraja(xs) {
      const r = [...xs];
      for (let i = r.length - 1; i > 0; i -= 1) {
        const k = ri(i + 1);
        [r[i], r[k]] = [r[k]!, r[i]!];
      }
      return r;
    },
    icono(k, x, y, z, r) {
      c.save();
      c.translate(x, y);
      if (r) c.rotate(r);
      dibujo(k)(c, z, tema);
      c.restore();
    },
    flota(x, y, txt, col) {
      flotantes.push({ x, y, txt, col: col ?? tema.t, a: 1 });
    },
    suma(v, x, y) {
      e.pts += v;
      m.flota(x, y, `+${v}`);
      if (!o.sinMovimiento)
        for (let i = 0; i < 8; i += 1)
          chispas.push({
            x,
            y,
            vx: m.rnd(-130, 130),
            vy: m.rnd(-260, -40),
            a: 1,
            c: i % 2 ? tema.a : '#fff',
          });
    },
    herida(x, y) {
      if (e.vidas === null) return;
      e.vidas -= 1;
      if (!o.sinMovimiento) choque = 0.35;
      m.flota(x, y, '¡Uy!', NUBLADO);
      if (e.vidas <= 0 && !e.fin) e.fin = 0.7;
    },
    sube() {
      e.nivel += 1;
      banner = 1.3;
    },
    rr(x, y, w, h, r, fill, lw) {
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      rellena(c, fill, lw ?? 2);
    },
    texto,
    charola(x, y, w) {
      c.save();
      c.translate(x, y);
      c.beginPath();
      c.ellipse(0, 14, w * 0.5, 6, 0, 0, TAU);
      c.fillStyle = 'rgba(0,0,0,.16)';
      c.fill();
      c.beginPath();
      c.moveTo(-w / 2, -10);
      c.lineTo(w / 2, -10);
      c.lineTo(w / 2 - 10, 10);
      c.lineTo(-w / 2 + 10, 10);
      c.closePath();
      rellena(c, tema.f, 3);
      c.fillStyle = tema.a;
      c.fillRect(-w / 2 + 4, -10, w - 8, 5);
      c.fillStyle = tema.s;
      c.font = `800 15px ${tema.fuente}`;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillText(tema.inicial, 0, 8);
      c.restore();
    },
    p0: () => tema.prods[0] ?? 'estrella',
    px: () => otros[ri(otros.length)] ?? 'estrella',
  };

  const juego = FABRICAS[o.juego](m);
  let ult = 0;
  let cuadro = 0;
  let vivo = true;
  let ultimo = '';

  const marcador = () => {
    const segundos = e.t === null ? null : Math.ceil(e.t);
    const vidas = e.vidas === null ? null : Math.max(0, e.vidas);
    const clave = `${e.pts}|${e.nivel}|${segundos}|${vidas}`;
    if (clave === ultimo) return;
    ultimo = clave;
    o.alMarcador({ puntos: e.pts, nivel: e.nivel, segundos, vidas, maxVidas: e.max });
  };

  const dibuja = () => {
    pintarFondo(c, W, H, dpr, tema);
    c.save();
    if (choque) c.translate((Math.random() - 0.5) * 8, 0);
    juego.dib();
    for (const q of chispas) {
      c.globalAlpha = Math.max(0, q.a);
      c.fillStyle = q.c;
      c.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    c.globalAlpha = 1;
    for (const f of flotantes) {
      c.globalAlpha = Math.max(0, f.a);
      texto(f.txt, f.x, f.y, 20, f.col);
    }
    c.globalAlpha = 1;
    if (banner > 0) {
      c.globalAlpha = Math.min(1, banner * 2);
      texto(`¡Nivel ${e.nivel}!`, W / 2, H * 0.42, 34);
      c.globalAlpha = 1;
    }
    c.restore();
  };

  const cerrar = () => {
    if (!vivo) return;
    vivo = false;
    cancelAnimationFrame(cuadro);
    observador.disconnect();
    marcador();
    o.alTerminar({ puntos: e.pts, nivel: e.nivel });
  };

  const paso = (ahora: number) => {
    if (!vivo) return;
    const dt = ult ? Math.min(0.05, Math.max(0, (ahora - ult) / 1000)) : 0;
    ult = ahora;
    if (e.fin > 0) {
      e.fin -= dt;
      if (e.fin <= 0) {
        dibuja();
        cerrar();
        return;
      }
    } else {
      juego.paso(dt);
      if (e.t !== null) {
        e.t -= dt;
        if (e.t <= 0) {
          e.t = 0;
          e.fin = 0.4;
        }
      }
    }
    for (const f of flotantes) {
      f.y -= 40 * dt;
      f.a -= dt * 1.3;
    }
    flotantes = flotantes.filter((f) => f.a > 0);
    for (const q of chispas) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 500 * dt;
      q.a -= dt * 1.8;
    }
    chispas = chispas.filter((q) => q.a > 0);
    choque = Math.max(0, choque - dt);
    banner = Math.max(0, banner - dt);
    dibuja();
    marcador();
    cuadro = requestAnimationFrame(paso);
  };
  cuadro = requestAnimationFrame(paso);

  const jugando = () => vivo && e.fin <= 0;
  return {
    abajo(x, y) {
      if (jugando()) juego.abajo?.(x, y);
    },
    mueve(x, y, presionado) {
      if (jugando()) juego.mueve?.(x, y, presionado);
    },
    arriba(x, y) {
      if (jugando()) juego.arriba?.(x, y);
    },
    tecla(lado, presionada) {
      teclas[lado] = presionada;
    },
    terminar() {
      if (jugando()) e.fin = 0.01;
    },
    detener() {
      vivo = false;
      cancelAnimationFrame(cuadro);
      observador.disconnect();
    },
  };
}
