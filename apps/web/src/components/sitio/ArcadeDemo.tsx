'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { COMBINACIONES, juegoPorId, palabrasPorGiro, productosPorGiro } from '@wl/domain';

import { dibujo, miniatura, type TemaArcade } from '@/lib/arcade/dibujos';
import {
  INFO_JUEGOS,
  JUGABLES,
  crearMotor,
  pintarFondo,
  type IdJugable,
  type Marcador,
  type Motor,
} from '@/lib/arcade/motor';

/**
 * Prueba del Arcade en el sitio: el mismo motor que juegan los clientes en su
 * tarjeta, con productos y colores de un giro de ejemplo. No abre partida en
 * el servidor ni guarda nada: es para que el dueño sienta el juego.
 */

/** Meta del reto de ejemplo «Haz 800 puntos en una partida esta semana». */
const META = 800;

const GIROS = [
  {
    id: 'cafeteria',
    nombre: 'Cafetería',
    colores: 'cafe-oscuro',
    inicial: 'C',
    promo: 'Pan dulce de cortesía con tu café',
  },
  {
    id: 'barberia',
    nombre: 'Barbería',
    colores: 'atemporal',
    inicial: 'B',
    promo: 'Arreglo de barba de cortesía',
  },
  {
    id: 'unas',
    nombre: 'Uñas',
    colores: 'fresas-crema',
    inicial: 'U',
    promo: 'Decoración de 2 uñas de cortesía',
  },
  {
    id: 'panaderia',
    nombre: 'Panadería',
    colores: 'citricos',
    inicial: 'P',
    promo: 'Café de cortesía con tu pan',
  },
] as const;

type Giro = (typeof GIROS)[number];
type Fase = 'inicio' | 'jugando' | 'fin';

function temaDe(g: Giro, fuente: string): TemaArcade {
  const c = (COMBINACIONES.find((x) => x.id === g.colores) ?? COMBINACIONES[0]!).colores;
  return {
    f: c.fondo,
    s: c.sobreFondo,
    a: c.acento,
    p: c.papel,
    t: c.tinta,
    inicial: g.inicial,
    prods: productosPorGiro(g.id).map((p) => p.icono),
    palabras: palabrasPorGiro(g.id),
    fuente,
  };
}

const iconoDeJuego = (id: IdJugable, tema: TemaArcade) => {
  const i = INFO_JUEGOS[id].icono;
  return i === 'producto' ? (tema.prods[0] ?? 'estrella') : i;
};

const nombreDe = (id: IdJugable) => juegoPorId(id)?.nombre ?? id;

function Miniatura({ nombre, tema }: { nombre: string; tema: TemaArcade }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) miniatura(ref.current, nombre, tema);
  }, [nombre, tema]);
  return <canvas ref={ref} aria-hidden="true" style={{ width: 44, height: 44 }} />;
}

export function ArcadeDemo() {
  const raiz = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const presionado = useRef(false);
  const [giro, setGiro] = useState<Giro>(GIROS[0]);
  const [juego, setJuego] = useState<IdJugable>('atrapa');
  const [fase, setFase] = useState<Fase>('inicio');
  const [marcador, setMarcador] = useState<Marcador | null>(null);
  const [fin, setFin] = useState<{ puntos: number; nivel: number } | null>(null);
  const [fuente, setFuente] = useState('system-ui, sans-serif');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (raiz.current)
      setFuente(getComputedStyle(raiz.current).fontFamily || 'system-ui, sans-serif');
  }, []);

  const tema = useMemo(() => temaDe(giro, fuente), [giro, fuente]);
  const info = INFO_JUEGOS[juego];
  const jugando = fase === 'jugando';

  // En reposo, el lienzo muestra el fondo del giro con el dibujo del juego.
  const pintarReposo = useCallback(() => {
    const cv = canvas.current;
    if (!cv || motor.current) return;
    const c = cv.getContext('2d');
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    pintarFondo(c, W, H, dpr, tema);
    c.save();
    c.globalAlpha = 0.18;
    c.translate(W / 2, H * 0.78);
    dibujo(iconoDeJuego(juego, tema))(c, Math.min(W, H) * 0.42, tema);
    c.restore();
  }, [juego, tema]);

  useEffect(() => {
    if (jugando) return;
    pintarReposo();
    const cv = canvas.current;
    if (!cv) return;
    const obs = new ResizeObserver(() => pintarReposo());
    obs.observe(cv);
    return () => obs.disconnect();
  }, [jugando, pintarReposo]);

  useEffect(() => () => motor.current?.detener(), []);

  // En el celular el juego ocupa la pantalla: sin desplazamiento debajo.
  useEffect(() => {
    if (!jugando || !window.matchMedia('(max-width: 700px)').matches) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = antes;
    };
  }, [jugando]);

  // Flechas del teclado para mover la charola en una computadora.
  useEffect(() => {
    if (!jugando) return;
    const lado = (k: string) =>
      k === 'ArrowLeft' || k === 'a' ? 'izq' : k === 'ArrowRight' || k === 'd' ? 'der' : null;
    const baja = (e: KeyboardEvent) => {
      const l = lado(e.key);
      if (!l) return;
      e.preventDefault();
      motor.current?.tecla(l, true);
    };
    const sube = (e: KeyboardEvent) => {
      const l = lado(e.key);
      if (l) motor.current?.tecla(l, false);
    };
    window.addEventListener('keydown', baja);
    window.addEventListener('keyup', sube);
    return () => {
      window.removeEventListener('keydown', baja);
      window.removeEventListener('keyup', sube);
    };
  }, [jugando]);

  const jugar = async () => {
    const cv = canvas.current;
    if (!cv) return;
    setError(null);
    setFin(null);
    setMarcador(null);
    setFase('jugando');
    // Se espera un cuadro para que el lienzo tenga su tamaño final.
    await new Promise<void>((listo) => requestAnimationFrame(() => listo()));
    try {
      motor.current = crearMotor({
        canvas: cv,
        tema,
        juego,
        semilla: Math.floor(Math.random() * 2 ** 31),
        sinMovimiento: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        alMarcador: setMarcador,
        alTerminar: (r) => {
          motor.current = null;
          setFin(r);
          setFase('fin');
        },
      });
    } catch (e) {
      motor.current = null;
      setError(e instanceof Error ? e.message : 'Este navegador no puede abrir el juego.');
      setFase('inicio');
    }
  };

  const punto = (e: PointerEvent<HTMLDivElement>): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const alBajar = (e: PointerEvent<HTMLDivElement>) => {
    const m = motor.current;
    if (!m) return;
    presionado.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    m.abajo(...punto(e));
  };
  const alMover = (e: PointerEvent<HTMLDivElement>) => {
    motor.current?.mueve(...punto(e), presionado.current);
  };
  const alSoltar = (e: PointerEvent<HTMLDivElement>) => {
    if (!presionado.current) return;
    presionado.current = false;
    motor.current?.arriba(...punto(e));
  };

  const elegir = (cambio: () => void) => {
    if (jugando) return;
    cambio();
    setFase('inicio');
    setFin(null);
  };

  return (
    <div ref={raiz} className="arc-demo">
      <div className="col" style={{ gap: 22, minWidth: 0 }}>
        <div className="col" style={{ gap: 10 }}>
          <span className="sm2">1. Elige un giro</span>
          <div className="row" role="group" aria-label="Giro de ejemplo" style={{ gap: 8 }}>
            {GIROS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={g.id === giro.id ? 'tab on' : 'tab'}
                aria-pressed={g.id === giro.id}
                disabled={jugando}
                onClick={() => elegir(() => setGiro(g))}
              >
                {g.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <span className="sm2">2. Elige un juego</span>
          <div className="arc-juegos" role="group" aria-label="Juegos">
            {JUGABLES.map((id) => (
              <button
                key={id}
                type="button"
                className={id === juego ? 'arc-j on' : 'arc-j'}
                aria-pressed={id === juego}
                disabled={jugando}
                onClick={() => elegir(() => setJuego(id))}
              >
                <Miniatura nombre={iconoDeJuego(id, tema)} tema={tema} />
                {nombreDe(id)}
              </button>
            ))}
          </div>
        </div>
        <p className="p" style={{ maxWidth: '30em' }}>
          Así lo ven tus clientes en su tarjeta: con tus colores, tu inicial y tus productos. Cada
          partida cuenta para retos como «Haz {META} puntos en una partida esta semana» →{' '}
          <b style={{ color: 'var(--ink)' }}>{giro.promo}</b>.
        </p>
      </div>

      <div className={jugando ? 'arc-pantalla jugando' : 'arc-pantalla'}>
        <div className="arc-marcador" aria-live="polite">
          {jugando && marcador ? (
            <>
              <b className="d" style={{ fontSize: 24 }}>
                {marcador.puntos}
              </b>
              <span>Nivel {marcador.nivel}</span>
              {marcador.segundos !== null && <span>{marcador.segundos} s</span>}
              {marcador.vidas !== null && (
                <span aria-label={`${marcador.vidas} vidas`} style={{ letterSpacing: 2 }}>
                  {'♥'.repeat(marcador.vidas)}
                  {'♡'.repeat(Math.max(0, marcador.maxVidas - marcador.vidas))}
                </span>
              )}
              <button type="button" className="arc-salir" onClick={() => motor.current?.terminar()}>
                Terminar
              </button>
            </>
          ) : (
            <span>
              {nombreDe(juego)} · {giro.nombre} de ejemplo
            </span>
          )}
        </div>
        <div
          className="arc-lienzo"
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <canvas
            ref={canvas}
            role="img"
            aria-label={`${nombreDe(juego)}. ${info.como}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
          {fase === 'inicio' && (
            <div className="arc-aviso">
              <b className="d h3">{nombreDe(juego)}</b>
              <span>{info.como}</span>
              <span className="sm2">{info.nivel}</span>
              {error && <b role="alert">{error}</b>}
              <button type="button" className="btn sm" onClick={jugar}>
                Jugar una partida
              </button>
            </div>
          )}
          {fase === 'fin' && fin && (
            <div className="arc-aviso">
              <span className="sm2">Tu partida de {nombreDe(juego)}</span>
              <b className="d" style={{ fontSize: 56, lineHeight: 1 }}>
                {fin.puntos}
              </b>
              <span>puntos · nivel {fin.nivel}</span>
              <span>
                {fin.puntos >= META
                  ? `¡Lo lograste! En un club real te llevarías: ${giro.promo}.`
                  : `Con ${META} puntos en una partida te llevarías: ${giro.promo}. Te faltaron ${META - fin.puntos}.`}
              </span>
              <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
                <button type="button" className="btn sm" onClick={jugar}>
                  Otra vez
                </button>
                <button type="button" className="tab" onClick={() => setFase('inicio')}>
                  Otro juego
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
