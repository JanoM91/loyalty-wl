'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

import { cerrarPartida, empezarPartida } from '@/app/lealtad/juegos/acciones';
import { dibujo, miniatura, type TemaArcade } from '@/lib/arcade/dibujos';
import {
  INFO_JUEGOS,
  crearMotor,
  pintarFondo,
  type IdJugable,
  type Marcador,
  type Motor,
} from '@/lib/arcade/motor';

export type TemaSinFuente = Omit<TemaArcade, 'fuente'>;

interface JuegoDeHoy {
  readonly id: IdJugable;
  readonly nombre: string;
  readonly dificultad: string;
}

interface Resultado {
  readonly puntos: number;
  readonly nivel: number;
  readonly sospechosa: boolean;
  readonly cupones: readonly { codigo: string; titulo: string; vence: Date }[];
}

type Fase = 'inicio' | 'abriendo' | 'jugando' | 'guardando' | 'fin';

const fechaCorta = (d: Date) =>
  new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

function fuenteDelDocumento(): string {
  return getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
}

function iconoDeJuego(id: IdJugable, tema: TemaSinFuente): string {
  const i = INFO_JUEGOS[id].icono;
  return i === 'producto' ? (tema.prods[0] ?? 'estrella') : i;
}

/** Un dibujo del Arcade en un canvas pequeño, con los colores de la marca. */
export function Miniatura({ nombre, tema }: { nombre: string; tema: TemaSinFuente }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) miniatura(ref.current, nombre, { ...tema, fuente: fuenteDelDocumento() });
  }, [nombre, tema]);
  return <canvas ref={ref} aria-hidden="true" className="h-11 w-11" />;
}

/**
 * Los juegos del club en la tarjeta del cliente.
 *
 * Abre la partida en el servidor, juega en un canvas y la cierra con el
 * puntaje. Al terminar refresca la página para que los retos, los cupones y
 * la lista de abajo se pongan al día.
 */
export function Arcade({
  tema,
  juegos,
  partidasDia,
  jugadasHoy,
  semanal,
}: {
  tema: TemaSinFuente;
  juegos: readonly JuegoDeHoy[];
  partidasDia: number;
  jugadasHoy: number;
  /** Un solo juego que cambia cada lunes. */
  semanal: boolean;
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<IdJugable>(juegos[0]!.id);
  const [fase, setFase] = useState<Fase>('inicio');
  const [marcador, setMarcador] = useState<Marcador | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quedan, setQuedan] = useState(Math.max(0, partidasDia - jugadasHoy));
  const canvas = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const partida = useRef<string | null>(null);
  const presionado = useRef(false);

  const juego = juegos.find((j) => j.id === elegido) ?? juegos[0]!;
  const info = INFO_JUEGOS[juego.id];
  const jugando = fase === 'jugando';
  /** Mientras se juega, el juego ocupa toda la pantalla: sin barra ni desplazamiento encima. */
  const completa = fase !== 'inicio';

  // En reposo, el canvas muestra el fondo de la marca con el dibujo del juego.
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
    const t = { ...tema, fuente: fuenteDelDocumento() };
    pintarFondo(c, W, H, dpr, t);
    c.save();
    c.globalAlpha = 0.18;
    c.translate(W / 2, H * 0.78);
    dibujo(iconoDeJuego(juego.id, tema))(c, Math.min(W, H) * 0.42, t);
    c.restore();
  }, [juego.id, tema]);

  useEffect(() => {
    if (fase === 'jugando') return;
    pintarReposo();
    const cv = canvas.current;
    if (!cv) return;
    const obs = new ResizeObserver(() => pintarReposo());
    obs.observe(cv);
    return () => obs.disconnect();
  }, [fase, pintarReposo]);

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

  useEffect(() => () => motor.current?.detener(), []);

  useEffect(() => {
    if (!completa) return;
    const raiz = document.documentElement;
    const antes = raiz.style.overflow;
    raiz.style.overflow = 'hidden';
    return () => {
      raiz.style.overflow = antes;
    };
  }, [completa]);

  const cerrar = useCallback(
    async (fin: { puntos: number; nivel: number }) => {
      motor.current = null;
      setFase('guardando');
      const id = partida.current;
      partida.current = null;
      const r = id ? await cerrarPartida(id, fin.puntos, fin.nivel).catch(() => null) : null;
      if (r?.ok) {
        setResultado({
          puntos: r.puntos,
          nivel: fin.nivel,
          sospechosa: r.sospechosa,
          cupones: r.cupones,
        });
      } else {
        setResultado({ ...fin, sospechosa: false, cupones: [] });
        setError(r && !r.ok ? r.error : 'No pudimos guardar tu partida. Revisa tu conexión.');
      }
      setFase('fin');
      router.refresh();
    },
    [router],
  );

  const jugar = async () => {
    const cv = canvas.current;
    if (!cv || quedan <= 0) return;
    setError(null);
    setResultado(null);
    setFase('abriendo');
    const r = await empezarPartida(juego.id).catch(() => null);
    if (!r || !r.ok) {
      setError(r?.error ?? 'No pudimos abrir la partida. Revisa tu conexión.');
      setFase('inicio');
      return;
    }
    partida.current = r.id;
    setQuedan(r.quedanHoy);
    setMarcador(null);
    // La pantalla ya pasó a completa mientras se abría la partida; se espera un
    // cuadro para que el canvas tenga su tamaño final antes de acomodar el juego.
    await new Promise<void>((listo) => requestAnimationFrame(() => listo()));
    try {
      motor.current = crearMotor({
        canvas: cv,
        tema: { ...tema, fuente: fuenteDelDocumento() },
        juego: juego.id,
        semilla: r.semilla,
        sinMovimiento: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        alMarcador: setMarcador,
        alTerminar: (fin) => void cerrar(fin),
      });
      setFase('jugando');
    } catch (e) {
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

  const textoQuedan =
    quedan <= 0
      ? 'Ya jugaste tus partidas de hoy'
      : `Te ${quedan === 1 ? 'queda' : 'quedan'} ${quedan} ${quedan === 1 ? 'partida' : 'partidas'} hoy`;

  return (
    <section aria-label="Juegos" className="grid gap-3">
      {juegos.length > 1 && (
        <div
          role="group"
          aria-label="Elige un juego"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
        >
          {juegos.map((j) => (
            <button
              key={j.id}
              type="button"
              aria-pressed={j.id === elegido}
              disabled={fase !== 'inicio' && fase !== 'fin'}
              onClick={() => {
                setElegido(j.id);
                setFase('inicio');
                setResultado(null);
                setError(null);
              }}
              className="grid min-w-[86px] flex-none justify-items-center gap-1 rounded-md border border-rule bg-cream px-2 py-2 text-center text-[13px] leading-tight font-semibold text-ink aria-pressed:border-ink aria-pressed:shadow-[inset_0_0_0_1px_var(--wl-tinta)] disabled:opacity-50"
            >
              <Miniatura nombre={iconoDeJuego(j.id, tema)} tema={tema} />
              {j.nombre}
              <span className="text-[11px] font-normal text-muted">{j.dificultad}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className={
          completa
            ? 'fixed inset-0 z-50 mx-auto flex max-w-md flex-col gap-2 bg-crumb px-3 pb-3'
            : 'grid gap-3'
        }
        style={completa ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' } : undefined}
        role={completa ? 'dialog' : undefined}
        aria-modal={completa || undefined}
        aria-label={completa ? juego.nombre : undefined}
      >
        <div
          className="flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-rule bg-cream px-3.5 py-2 text-sm text-ink"
          aria-live="polite"
        >
          {jugando && marcador ? (
            <>
              <b className="font-display text-xl tabular-nums">{marcador.puntos}</b>
              <span>Nivel {marcador.nivel}</span>
              {marcador.segundos !== null && (
                <span className="tabular-nums">{marcador.segundos} s</span>
              )}
              {marcador.vidas !== null && (
                <span aria-label={`${marcador.vidas} vidas`} className="tracking-widest">
                  {'♥'.repeat(marcador.vidas)}
                  {'♡'.repeat(Math.max(0, marcador.maxVidas - marcador.vidas))}
                </span>
              )}
              <button
                type="button"
                onClick={() => motor.current?.terminar()}
                className="min-h-[36px] rounded-sm border border-rule px-2.5 text-[13px] font-semibold"
              >
                Terminar
              </button>
            </>
          ) : (
            <span>
              {semanal ? 'Juego de la semana · ' : ''}
              {textoQuedan}
            </span>
          )}
        </div>

        <div
          className={`relative overflow-hidden rounded-xl border border-rule bg-cream select-none ${completa ? 'min-h-0 flex-1 touch-none' : ''}`}
          style={completa ? undefined : { height: 'min(72vh, 34rem)' }}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
        >
          <canvas
            ref={canvas}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`${juego.nombre}. ${info.como}`}
          />

          {fase === 'abriendo' && (
            <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-ink">
              Abriendo tu partida…
            </div>
          )}

          {fase === 'inicio' && (
            <div className="absolute inset-x-3 top-1/2 grid -translate-y-1/2 justify-items-center gap-3 rounded-lg bg-cream/95 p-5 text-center shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]">
              <h2 className="text-2xl text-ink">{juego.nombre}</h2>
              <p className="max-w-[32ch] text-sm text-ink-soft">{info.como}</p>
              <p className="max-w-[32ch] text-xs text-muted">{info.nivel}</p>
              {error && (
                <p role="alert" className="text-sm font-semibold text-ink">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={jugar}
                disabled={quedan <= 0}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-ink px-8 text-[17px] font-semibold text-cream disabled:opacity-40"
              >
                {quedan <= 0 ? 'Vuelve mañana' : 'Jugar'}
              </button>
            </div>
          )}

          {fase === 'guardando' && (
            <div className="absolute inset-0 grid place-items-center bg-cream/70 text-sm font-semibold text-ink">
              Guardando tu partida…
            </div>
          )}

          {fase === 'fin' && resultado && (
            <div className="absolute inset-x-3 top-1/2 grid max-h-[calc(100%-24px)] -translate-y-1/2 justify-items-center gap-3 overflow-y-auto rounded-lg bg-cream/95 p-5 text-center shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]">
              <p className="text-sm text-muted">Tu partida de {juego.nombre}</p>
              <p className="font-display text-5xl leading-none text-ink tabular-nums">
                {resultado.puntos}
              </p>
              <p className="text-sm text-ink-soft">puntos · llegaste al nivel {resultado.nivel}</p>
              {resultado.sospechosa && (
                <p className="max-w-[34ch] text-xs text-ink-soft">
                  Esta partida no cuenta para los retos: el puntaje no cuadra con el tiempo jugado.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm font-semibold text-ink">
                  {error}
                </p>
              )}
              {resultado.cupones.map((c) => (
                <div
                  key={c.codigo}
                  className="grid w-full gap-0.5 rounded-md bg-ink px-4 py-3 text-cream"
                >
                  <span className="text-xs">¡Desbloqueaste una promoción!</span>
                  <b className="font-display text-lg leading-tight">{c.titulo}</b>
                  <span className="text-xs">
                    Código <span className="font-mono font-semibold">{c.codigo}</span> · muéstralo
                    en caja · vence el {fechaCorta(c.vence)}
                  </span>
                </div>
              ))}
              <div className="flex flex-wrap justify-center gap-2">
                {quedan > 0 && (
                  <button
                    type="button"
                    onClick={jugar}
                    className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-ink px-7 text-[17px] font-semibold text-cream"
                  >
                    Jugar otra vez
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFase('inicio')}
                  className={
                    quedan > 0
                      ? 'inline-flex min-h-[52px] items-center justify-center rounded-full border border-rule px-6 text-[17px] font-semibold text-ink'
                      : 'inline-flex min-h-[52px] items-center justify-center rounded-full bg-ink px-8 text-[17px] font-semibold text-cream'
                  }
                >
                  {quedan > 0 ? 'Salir' : 'Listo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
