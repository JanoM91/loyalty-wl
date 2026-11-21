'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { salir } from '@/app/admin/entrar/acciones';

import { Paleta, type ComandoPaleta } from '../Paleta';
import type { DatosMapa } from './tipos';
import './constelacion.css';

/**
 * Mapa del club («Constelación»): el inicio del panel.
 *
 * Cada parte del club es una tarjeta en un lienzo: el club al centro y, a su
 * alrededor, el premio, los clientes, la caja, las sucursales, la marca y el
 * equipo, unidos por hilos que dicen qué afecta a qué. Lejos se ve el mapa;
 * al acercarse cada tarjeta muestra más; al tocar una, se acerca y muestra
 * sus acciones. ⌘K abre la paleta y el modo enfoque aísla una tarjeta.
 *
 * Lo que el dueño acomoda (posiciones, hilos propios y notas) se guarda en
 * este navegador; no viaja al servidor.
 */

interface Punto {
  readonly x: number;
  readonly y: number;
}
interface Nota extends Punto {
  readonly id: string;
  readonly texto: string;
}
interface Guardado {
  readonly pos: Readonly<Record<string, Punto>>;
  readonly hilos: readonly (readonly [string, string])[];
  readonly notas: readonly Nota[];
}
interface Vista {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}
interface Nodo {
  readonly id: string;
  readonly titulo: string;
  readonly kpi: string;
  readonly kpiRojo?: boolean;
  readonly inicial: string;
  readonly tinte: string;
  readonly tintaInicial?: string;
  readonly lineas: readonly string[];
  readonly alerta?: boolean;
}

const POSICIONES: Readonly<Record<string, Punto>> = {
  arranque: { x: 0, y: -360 },
  club: { x: 0, y: -40 },
  premio: { x: -460, y: -200 },
  clientes: { x: -470, y: 230 },
  caja: { x: 0, y: 320 },
  sucursales: { x: 460, y: 200 },
  marca: { x: 450, y: -210 },
  equipo: { x: 470, y: 520 },
  numeros: { x: -470, y: 560 },
  revisar: { x: 0, y: 640 },
};

const HILOS: readonly (readonly [string, string])[] = [
  ['arranque', 'club'],
  ['club', 'premio'],
  ['club', 'marca'],
  ['club', 'sucursales'],
  ['sucursales', 'caja'],
  ['caja', 'clientes'],
  ['premio', 'clientes'],
  ['equipo', 'caja'],
  ['numeros', 'clientes'],
  ['revisar', 'caja'],
];

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.9;
const VACIO: Guardado = { pos: {}, hilos: [], notas: [] };

const nivelDe = (z: number) => (z < 0.9 ? 'mapa' : z < 1.3 ? 'seccion' : 'detalle');
const limitar = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function anchoDe(id: string, nivel: string, detalle: boolean): number {
  if (detalle) return id === 'sucursales' || id === 'arranque' ? 400 : 370;
  return nivel === 'mapa' ? 230 : 270;
}

export function Constelacion({
  datos,
  comandos,
}: {
  datos: DatosMapa;
  comandos: readonly ComandoPaleta[];
}) {
  const d = datos;
  const n = d.numeros;
  const clave = `wl-mapa:${d.slug}`;

  // ---------------------------------------------------------------- nodos
  const nodos = useMemo<Nodo[]>(() => {
    const premio = d.programa.hitos[d.programa.hitos.length - 1];
    const lista: Nodo[] = [];
    if (d.arranque) {
      const listos = d.arranque.filter((p) => p.hecho).length;
      lista.push({
        id: 'arranque',
        titulo: 'Arranca tu club',
        kpi: `${listos} de ${d.arranque.length} pasos`,
        inicial: '1',
        tinte: '#D6F5E8',
        lineas: d.arranque.filter((p) => !p.hecho).map((p) => `Falta: ${p.titulo.toLowerCase()}`),
      });
    }
    lista.push({
      id: 'club',
      titulo: d.negocio.nombre,
      kpi: d.estado.texto,
      kpiRojo: d.estado.pausa,
      inicial: d.negocio.nombre.trim().charAt(0).toUpperCase() || 'C',
      tinte: '#E6E1FF',
      lineas: [],
    });
    lista.push({
      id: 'premio',
      titulo: 'Premio',
      kpi: premio ? premio.nombre : 'Sin premio',
      inicial: 'P',
      tinte: '#FFF1C2',
      lineas: [
        plural(d.programa.posiciones, 'sello de visita', 'sellos de visita') + ' por tarjeta',
        plural(n.premiosListos, 'premio listo para cobrar', 'premios listos para cobrar'),
        `Entregados en 7 días: ${n.premiosEntregados}`,
      ],
    });
    lista.push({
      id: 'clientes',
      titulo: 'Clientes',
      kpi: plural(n.tarjetas, 'tarjeta', 'tarjetas'),
      inicial: 'C',
      tinte: '#D6F5E8',
      lineas: [
        `${plural(n.nuevas, 'nueva', 'nuevas')} en 7 días`,
        `${plural(n.activos, 'volvió', 'volvieron')} en 7 días`,
        `${plural(n.verificadas, 'verificada', 'verificadas')} para cobrar premios`,
      ],
    });
    lista.push({
      id: 'caja',
      titulo: 'Caja',
      kpi: `${plural(n.sellosHoy, 'sello', 'sellos')} hoy`,
      inicial: 'K',
      tinte: '#06231C',
      tintaInicial: '#F1FBF6',
      lineas: [
        `${plural(n.sellosSemana, 'sello', 'sellos')} en 7 días`,
        'Ábrela en tu celular o tableta',
      ],
    });
    const unica = d.sucursales.length === 1 ? d.sucursales[0] : null;
    lista.push({
      id: 'sucursales',
      titulo: unica ? unica.nombre : 'Sucursales',
      kpi: unica ? 'Cartel QR' : plural(d.sucursales.length, 'sucursal', 'sucursales'),
      inicial: 'Q',
      tinte: '#E6E1FF',
      lineas: d.sucursales
        .slice(0, 3)
        .map((s) => `${s.nombre}: ${s.participa ? 'participa' : 'apagada'}`),
    });
    if (d.administra) {
      lista.push({
        id: 'marca',
        titulo: 'Marca',
        kpi: d.marcaPendiente[0] ?? 'Completa',
        inicial: 'M',
        tinte: '#FFE1EC',
        lineas:
          d.marcaPendiente.length > 0 ? d.marcaPendiente : ['Logotipo, colores y contacto listos'],
      });
      lista.push({
        id: 'equipo',
        titulo: 'Equipo',
        kpi: plural(d.equipo.length, 'persona', 'personas'),
        inicial: 'E',
        tinte: '#FFF1C2',
        lineas: d.equipo.slice(0, 3).map((u) => `${u.nombre} · ${u.rol}`),
      });
    }
    lista.push({
      id: 'numeros',
      titulo: 'Números',
      kpi: `${plural(n.activos, 'cliente volvió', 'clientes volvieron')}`,
      inicial: 'N',
      tinte: '#D6F5E8',
      lineas: [
        `${plural(n.sellosSemana, 'sello', 'sellos')} en 7 días`,
        `${n.nuevas} tarjetas nuevas`,
      ],
    });
    if (n.pendientes > 0) {
      lista.push({
        id: 'revisar',
        titulo: 'Por revisar',
        kpi: plural(n.pendientes, 'visita', 'visitas'),
        kpiRojo: true,
        inicial: '!',
        tinte: '#FFE7C2',
        lineas: ['La caja dejó estas visitas para que las apruebes'],
        alerta: true,
      });
    }
    return lista;
  }, [d, n]);

  // ---------------------------------------------------------------- estado
  const [vista, setVista] = useState<Vista>({ zoom: 0.7, x: 0, y: 0 });
  const [sel, setSel] = useState<string | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [conectando, setConectando] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<Guardado>(VACIO);
  const [moviendo, setMoviendo] = useState(false);
  const [tam, setTam] = useState({ w: 1280, h: 800, medido: false });
  const cargado = useRef(false);
  const caja = useRef<HTMLDivElement>(null);
  const punteros = useRef(new Map<number, Punto>());
  const pellizco = useRef<{ dist: number; zoom: number; centro: Punto; vista: Vista } | null>(null);
  const arrastreNodo = useRef<{
    id: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
    movido: boolean;
  } | null>(null);
  const acabaDeArrastrar = useRef(false);
  const temporizadorRueda = useRef<number | undefined>(undefined);

  const nivel = nivelDe(vista.zoom);
  const movil = tam.w < 720;

  const posDe = useCallback(
    (id: string): Punto | null => {
      const nota = guardado.notas.find((x) => x.id === id);
      if (nota) return nota;
      return guardado.pos[id] ?? POSICIONES[id] ?? null;
    },
    [guardado],
  );

  const visibles = useMemo(
    () => nodos.map((x) => x.id).concat(guardado.notas.map((x) => x.id)),
    [nodos, guardado],
  );

  /** Vista que muestra todo el mapa en la ventana. */
  const ajustada = useCallback((): Vista => {
    const puntos = visibles.map((id) => posDe(id)).filter((p): p is Punto => p !== null);
    if (puntos.length === 0) return { zoom: 0.8, x: 0, y: 0 };
    const minX = Math.min(...puntos.map((p) => p.x)) - 150;
    const maxX = Math.max(...puntos.map((p) => p.x)) + 150;
    const minY = Math.min(...puntos.map((p) => p.y)) - 110;
    const maxY = Math.max(...puntos.map((p) => p.y)) + 110;
    const zoom = limitar(
      Math.min((tam.w - 48) / (maxX - minX), (tam.h - 150) / (maxY - minY), 0.88),
    );
    return { zoom, x: -((minX + maxX) / 2) * zoom, y: -((minY + maxY) / 2) * zoom + 20 };
  }, [visibles, posDe, tam]);

  const irA = useCallback(
    (id: string, enfocar = false) => {
      const p = posDe(id);
      if (!p) return;
      const ancho = anchoDe(id, 'detalle', true);
      const zoom = Math.min(1.45, (tam.w - 32) / ancho);
      setSel(id);
      if (enfocar) setFoco(id);
      setVista({ zoom, x: -p.x * zoom, y: -p.y * zoom + (movil ? 30 : 0) });
    },
    [posDe, tam, movil],
  );

  const verTodo = useCallback(() => {
    setSel(null);
    setFoco(null);
    setConectando(null);
    setVista(ajustada());
  }, [ajustada]);

  // Tamaño de la ventana y estado guardado en este navegador.
  useEffect(() => {
    const medir = () => setTam({ w: window.innerWidth, h: window.innerHeight, medido: true });
    medir();
    window.addEventListener('resize', medir);
    try {
      const crudo = window.localStorage.getItem(clave);
      if (crudo) {
        const g = JSON.parse(crudo) as Partial<Guardado>;
        setGuardado({ pos: g.pos ?? {}, hilos: g.hilos ?? [], notas: g.notas ?? [] });
      }
    } catch {
      // Sin almacenamiento (modo privado, permisos): el mapa funciona igual.
    }
    cargado.current = true;
    return () => window.removeEventListener('resize', medir);
  }, [clave]);

  useEffect(() => {
    if (!cargado.current) return;
    try {
      window.localStorage.setItem(clave, JSON.stringify(guardado));
    } catch {
      // Ídem.
    }
  }, [guardado, clave]);

  // Vista inicial: el mapa completo; en el celular, la caja en enfoque.
  const inicial = useRef(false);
  useEffect(() => {
    if (inicial.current || !tam.medido) return;
    inicial.current = true;
    if (tam.w < 720) irA('caja', true);
    else setVista(ajustada());
  }, [tam, irA, ajustada]);

  // Rueda: acerca alrededor del puntero (con Ctrl o rueda de mouse) o mueve (trackpad).
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    function rueda(e: WheelEvent) {
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      const sx = e.clientX - r.left - r.width / 2;
      const sy = e.clientY - r.top - r.height / 2;
      const esZoom = e.ctrlKey || e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 40 && e.deltaX === 0);
      setMoviendo(true);
      setVista((v) => {
        if (!esZoom) return { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY };
        const z = limitar(v.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
        const k = z / v.zoom;
        return { zoom: z, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k };
      });
      window.clearTimeout(temporizadorRueda.current);
      temporizadorRueda.current = window.setTimeout(() => setMoviendo(false), 120);
    }
    el.addEventListener('wheel', rueda, { passive: false });
    return () => el.removeEventListener('wheel', rueda);
  }, []);

  // Esc: sale del enfoque, cancela la conexión o regresa al mapa.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (foco) setFoco(null);
      else if (conectando) setConectando(null);
      else if (sel) verTodo();
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [foco, conectando, sel, verTodo]);

  // ------------------------------------------------------- gestos del fondo
  function bajarFondo(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setConectando(null);
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()] as [Punto, Punto];
      const r = caja.current!.getBoundingClientRect();
      pellizco.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: vista.zoom,
        centro: {
          x: (a.x + b.x) / 2 - r.left - r.width / 2,
          y: (a.y + b.y) / 2 - r.top - r.height / 2,
        },
        vista,
      };
    }
    setMoviendo(true);
  }

  function moverFondo(e: React.PointerEvent) {
    const antes = punteros.current.get(e.pointerId);
    if (!antes) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size >= 2 && pellizco.current) {
      const [a, b] = [...punteros.current.values()] as [Punto, Punto];
      const p = pellizco.current;
      const z = limitar((p.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / p.dist);
      const k = z / p.vista.zoom;
      setVista({
        zoom: z,
        x: p.centro.x - (p.centro.x - p.vista.x) * k,
        y: p.centro.y - (p.centro.y - p.vista.y) * k,
      });
      return;
    }
    setVista((v) => ({ ...v, x: v.x + e.clientX - antes.x, y: v.y + e.clientY - antes.y }));
  }

  function soltarFondo(e: React.PointerEvent) {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
    if (punteros.current.size === 0) setMoviendo(false);
  }

  // ---------------------------------------------------- gestos de las tarjetas
  function bajarNodo(e: React.PointerEvent, id: string) {
    const destino = e.target as HTMLElement;
    if (destino.closest('.cn-det, .cn-ctl, textarea, input, a')) return;
    const p = posDe(id);
    if (!p) return;
    // La captura del puntero se pide hasta que de verdad se arrastra: pedirla
    // aquí haría que el clic dejara de llegar al botón de la tarjeta.
    arrastreNodo.current = { id, x: e.clientX, y: e.clientY, ox: p.x, oy: p.y, movido: false };
  }

  function moverNodo(e: React.PointerEvent) {
    const a = arrastreNodo.current;
    if (!a) return;
    const dx = (e.clientX - a.x) / vista.zoom;
    const dy = (e.clientY - a.y) / vista.zoom;
    if (!a.movido && Math.hypot(dx, dy) * vista.zoom < 6) return;
    if (!a.movido) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    a.movido = true;
    const nuevo = { x: Math.round(a.ox + dx), y: Math.round(a.oy + dy) };
    setGuardado((g) =>
      g.notas.some((x) => x.id === a.id)
        ? { ...g, notas: g.notas.map((x) => (x.id === a.id ? { ...x, ...nuevo } : x)) }
        : { ...g, pos: { ...g.pos, [a.id]: nuevo } },
    );
  }

  function soltarNodo() {
    const a = arrastreNodo.current;
    arrastreNodo.current = null;
    if (a?.movido) {
      acabaDeArrastrar.current = true;
      window.setTimeout(() => (acabaDeArrastrar.current = false), 0);
    }
  }

  function tocarNodo(id: string) {
    if (acabaDeArrastrar.current) return;
    const desde = conectando;
    if (desde && desde !== id) {
      const existe = HILOS.concat(guardado.hilos).some(
        ([a, b]) => (a === desde && b === id) || (a === id && b === desde),
      );
      if (!existe) setGuardado((g) => ({ ...g, hilos: [...g.hilos, [desde, id] as const] }));
      setConectando(null);
      return;
    }
    if (sel === id && nivel === 'detalle') return;
    irA(id);
  }

  function nuevaNota() {
    const id = `nota-${Date.now().toString(36)}`;
    const centro = { x: Math.round(-vista.x / vista.zoom), y: Math.round(-vista.y / vista.zoom) };
    setGuardado((g) => ({ ...g, notas: [...g.notas, { id, ...centro, texto: '' }] }));
    setSel(id);
  }

  // ---------------------------------------------------------------- paleta
  const elegido = sel ?? foco;
  const tituloDe = (id: string | null) =>
    id ? (nodos.find((x) => x.id === id)?.titulo ?? (id.startsWith('nota') ? 'Nota' : '')) : '';

  const comandosMapa: ComandoPaleta[] = [
    {
      id: 'm-caja',
      texto: 'Enfocar la caja',
      grupo: 'Enfoque',
      claves: 'sumar sello caja',
      run: () => irA('caja', true),
    },
    ...(elegido
      ? [
          {
            id: 'm-foco',
            texto: `Enfocar «${tituloDe(elegido)}»`,
            grupo: 'Enfoque',
            run: () => irA(elegido, true),
          },
          {
            id: 'm-conectar',
            texto: `Conectar «${tituloDe(elegido)}» con otra tarjeta`,
            grupo: 'Conectar',
            claves: 'hilo unir',
            run: () => setConectando(elegido),
          },
        ]
      : []),
    {
      id: 'm-nota',
      texto: 'Nueva nota en el mapa',
      grupo: 'Crear',
      claves: 'nota idea recordar',
      run: nuevaNota,
    },
    {
      id: 'm-todo',
      texto: 'Ver todo el mapa',
      grupo: 'Vista',
      claves: 'alejar inicio mapa',
      run: verTodo,
    },
    ...nodos.map((x) => ({
      id: `m-ir-${x.id}`,
      texto: `Ir a ${x.titulo}`,
      grupo: 'Mapa',
      claves: x.kpi,
      run: () => irA(x.id),
    })),
    {
      id: 'm-acomodar',
      texto: 'Acomodar el mapa como al principio',
      grupo: 'Vista',
      claves: 'reiniciar posiciones',
      run: () => {
        setGuardado((g) => ({ ...g, pos: {} }));
        setVista(ajustada());
      },
    },
  ];

  // ---------------------------------------------------------------- hilos
  const enlaces = HILOS.filter(([a, b]) => visibles.includes(a) && visibles.includes(b))
    .map((e) => ({ e, propio: false }))
    .concat(
      guardado.hilos
        .filter(([a, b]) => visibles.includes(a) && visibles.includes(b))
        .map((e) => ({ e, propio: true })),
    );

  function curva(a: Punto, b: Punto) {
    const mx = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
  }

  // ---------------------------------------------------------------- pista
  let pista = movil
    ? 'Pellizca para ver todo tu club · toca una tarjeta para abrirla'
    : 'Rueda para acercar · arrastra el fondo para moverte · ⌘K para acciones';
  if (nivel === 'seccion')
    pista = 'Toca una tarjeta para ver sus acciones · arrastra una tarjeta para acomodarla';
  if (nivel === 'detalle' && !movil) pista = 'Esc o doble clic en el fondo para ver todo el mapa';
  if (conectando)
    pista = `Toca la tarjeta que quieres unir con «${tituloDe(conectando)}» · Esc para cancelar`;
  if (foco)
    pista = movil
      ? 'Toca «Salir» para ver todo tu club'
      : 'Modo enfoque · Esc o «Salir» para volver al mapa';

  const migaVisible = Boolean(sel) && nivel !== 'mapa';
  const enlace = (ruta: string) => `${d.base}${ruta}`;

  // ---------------------------------------------------------------- detalle
  function detalle(id: string): ReactNode {
    const premioFinal = d.programa.hitos[d.programa.hitos.length - 1];
    switch (id) {
      case 'club':
        return (
          <>
            <MiniTarjeta datos={d} />
            <span>Así la ven tus clientes en su celular.</span>
            <a className="cn-btn sec" href={d.unete} target="_blank" rel="noreferrer">
              Verla como cliente
            </a>
            {d.estado.activar && (
              <a className="cn-btn" href={d.estado.activar} target="_blank" rel="noreferrer">
                {d.estado.pausa ? 'Activar mi club' : 'Seguir después de la prueba'}
              </a>
            )}
          </>
        );
      case 'arranque':
        return (
          <ol className="cn-pasos">
            {(d.arranque ?? []).map((p, i) => (
              <li key={p.titulo} className={p.hecho ? 'hecho' : undefined}>
                <a href={p.href} target={p.nuevaPestana ? '_blank' : undefined} rel="noreferrer">
                  <span className="n" aria-hidden="true">
                    {p.hecho ? '✓' : i + 1}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <b>{p.titulo}</b>
                    <span style={{ fontSize: 13.5, color: 'var(--cn-suave)' }}>
                      {p.hecho ? 'Listo.' : p.texto}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        );
      case 'premio':
        return (
          <>
            {d.programa.hitos.map((h) => (
              <span key={h.posicion}>
                Con <b>{plural(h.posicion, 'sello de visita', 'sellos de visita')}</b>:{' '}
                {h.nombre.toLowerCase()}
              </span>
            ))}
            <span>
              {plural(n.premiosListos, 'premio listo', 'premios listos')} para cobrar ·{' '}
              {plural(n.premiosEntregados, 'entregado', 'entregados')} en 7 días
            </span>
            <a className="cn-btn" href={enlace('/admin/lealtad/programa')}>
              {premioFinal ? 'Cambiar el premio o los sellos' : 'Definir el premio'}
            </a>
            <span style={{ fontSize: 13, color: 'var(--cn-suave)' }}>
              Cambiarlo crea una versión nueva: lo que tus clientes ya ganaron se respeta.
            </span>
          </>
        );
      case 'clientes':
        return (
          <>
            <form
              action={enlace('/admin/lealtad/tarjetas')}
              method="get"
              style={{ display: 'flex', gap: 8 }}
            >
              <label style={{ flex: 1 }}>
                <span className="sr-only">Buscar cliente</span>
                <input name="q" className="cn-campo" placeholder="Nombre, celular o código" />
              </label>
              <button type="submit" className="cn-btn">
                Buscar
              </button>
            </form>
            <span>
              {plural(n.tarjetas, 'tarjeta', 'tarjetas')} · {plural(n.nuevas, 'nueva', 'nuevas')} y{' '}
              {plural(n.activos, 'cliente que volvió', 'clientes que volvieron')} en 7 días
            </span>
            <a className="cn-lk" href={enlace('/admin/lealtad/tarjetas')}>
              Ver a todos tus clientes
            </a>
          </>
        );
      case 'caja':
        return (
          <>
            <a className="cn-btn grande" href={enlace('/admin/lealtad/caja')}>
              Sumar sello de visita
            </a>
            <span>
              Escanea la tarjeta del cliente o búscalo por su celular. También entregas premios
              desde aquí.
            </span>
            <span style={{ fontSize: 13, color: 'var(--cn-suave)' }}>
              Hoy: {plural(n.sellosHoy, 'sello', 'sellos')} · 7 días:{' '}
              {plural(n.sellosSemana, 'sello', 'sellos')}
            </span>
          </>
        );
      case 'sucursales': {
        const primera = d.sucursales.find((s) => s.participa) ?? d.sucursales[0];
        return (
          <>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {d.qr && (
                <div
                  className="cn-qr"
                  role="img"
                  aria-label="Código QR para que tus clientes saquen su tarjeta"
                  dangerouslySetInnerHTML={{ __html: d.qr }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span>Tus clientes lo escanean y sacan su tarjeta solos.</span>
                {primera && (
                  <a
                    className="cn-btn violeta"
                    href={enlace(`/admin/lealtad/sucursales/cartel/${primera.slug}`)}
                  >
                    Imprimir cartel
                  </a>
                )}
              </div>
            </div>
            {d.sucursales.length > 1 &&
              d.sucursales.map((s) => (
                <span key={s.slug}>
                  {s.nombre}: {s.participa ? 'participa' : 'apagada'}
                </span>
              ))}
            <a className="cn-lk" href={enlace('/admin/lealtad/sucursales')}>
              Sucursales y códigos
            </a>
          </>
        );
      }
      case 'marca':
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {d.negocio.logoUrl ? (
                <img
                  src={d.negocio.logoUrl}
                  alt={`Logotipo de ${d.negocio.nombre}`}
                  style={{ maxHeight: 48, maxWidth: 120 }}
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '1.5px dashed var(--cn-suave)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    color: 'var(--cn-suave)',
                  }}
                >
                  Logo
                </span>
              )}
              <span style={{ display: 'flex', gap: 6 }} aria-label="Colores de tu tarjeta">
                {[d.negocio.colores.fondo, d.negocio.colores.acento, d.negocio.colores.sobre].map(
                  (c) => (
                    <span
                      key={c}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: c,
                        border: '1px solid #CDE8DC',
                      }}
                    />
                  ),
                )}
              </span>
            </div>
            {d.marcaPendiente.map((m) => (
              <span key={m}>{m}</span>
            ))}
            <a className="cn-btn" href={enlace('/admin/marca')}>
              Editar marca y datos
            </a>
          </>
        );
      case 'equipo':
        return (
          <>
            {d.equipo.map((u, i) => (
              <span key={`${u.nombre}-${i}`}>
                {u.nombre} · {u.rol}
              </span>
            ))}
            <a className="cn-btn sec" href={enlace('/admin/usuarios/nuevo')}>
              Invitar a alguien de caja
            </a>
          </>
        );
      case 'numeros':
        return (
          <>
            <span>
              {plural(n.activos, 'cliente volvió', 'clientes volvieron')} ·{' '}
              {plural(n.sellosSemana, 'sello', 'sellos')} ·{' '}
              {plural(n.premiosEntregados, 'premio entregado', 'premios entregados')} en 7 días
            </span>
            <a className="cn-btn" href={enlace('/admin/lealtad/analitica')}>
              Ver cómo va el programa
            </a>
            <a className="cn-lk" href={enlace('/admin/lealtad')}>
              Resumen de la semana
            </a>
          </>
        );
      case 'revisar':
        return (
          <>
            <span>Contingencias y tickets fuera de plazo que la caja dejó para ti.</span>
            <a className="cn-btn" href={enlace('/admin/lealtad/pendientes')}>
              Revisar {plural(n.pendientes, 'visita', 'visitas')}
            </a>
          </>
        );
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- vista
  return (
    <div className="cn" ref={caja}>
      <div
        className={moviendo ? 'cn-fondo arrastrando' : 'cn-fondo'}
        onPointerDown={bajarFondo}
        onPointerMove={moverFondo}
        onPointerUp={soltarFondo}
        onPointerCancel={soltarFondo}
        onDoubleClick={verTodo}
      />

      <div
        className={moviendo ? 'cn-mundo sin-transicion' : 'cn-mundo'}
        style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})` }}
      >
        <svg className="cn-hilos" aria-hidden="true">
          {enlaces.map(({ e: [a, b], propio }) => {
            const pa = posDe(a);
            const pb = posDe(b);
            if (!pa || !pb) return null;
            const activo = elegido !== null && (a === elegido || b === elegido);
            const apagado = foco !== null && a !== foco && b !== foco;
            const clase = [activo && 'activo', propio && 'propio', apagado && 'apagado']
              .filter(Boolean)
              .join(' ');
            return <path key={`${a}-${b}`} d={curva(pa, pb)} className={clase || undefined} />;
          })}
        </svg>

        {nodos.map((x) => {
          const p = posDe(x.id);
          if (!p) return null;
          const detalleVisible = sel === x.id && (nivel === 'detalle' || foco === x.id || movil);
          const clases = [
            'cn-nodo',
            sel === x.id || foco === x.id ? 'sel' : '',
            conectando && conectando !== x.id ? 'destino' : '',
            foco && foco !== x.id ? 'apagado' : '',
            x.alerta ? 'alerta' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <section
              key={x.id}
              className={clases}
              aria-label={x.titulo}
              style={{ left: p.x, top: p.y, width: anchoDe(x.id, nivel, detalleVisible) }}
              onPointerDown={(e) => bajarNodo(e, x.id)}
              onPointerMove={moverNodo}
              onPointerUp={soltarNodo}
              onPointerCancel={soltarNodo}
            >
              <div className="cn-cab">
                <button
                  type="button"
                  className="cn-abrir"
                  onClick={() => tocarNodo(x.id)}
                  aria-expanded={detalleVisible}
                >
                  <span
                    className="cn-ini"
                    aria-hidden="true"
                    style={{ background: x.tinte, color: x.tintaInicial ?? 'var(--cn-tinta)' }}
                  >
                    {x.inicial}
                  </span>
                  <span className="cn-tit">
                    <b>{x.titulo}</b>
                    <span className={x.kpiRojo ? 'rojo' : undefined}>{x.kpi}</span>
                  </span>
                </button>
                <div className="cn-ctl">
                  <button
                    type="button"
                    className="cn-ic"
                    title="Enfocar"
                    aria-label={`Enfocar ${x.titulo}`}
                    onClick={() => (foco === x.id ? setFoco(null) : irA(x.id, true))}
                  >
                    <svg
                      aria-hidden="true"
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <circle cx="12" cy="12" r="8" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cn-ic"
                    title="Conectar"
                    aria-label={`Conectar ${x.titulo} con otra tarjeta`}
                    onClick={() => setConectando(x.id)}
                  >
                    <svg
                      aria-hidden="true"
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <path d="M9.5 14.5l5-5" />
                      <path d="M11 6.5l1.6-1.6a4 4 0 0 1 5.6 5.6L16.6 12" />
                      <path d="M13 17.5l-1.6 1.6a4 4 0 0 1-5.6-5.6L7.4 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {!detalleVisible && x.id === 'club' && nivel !== 'mapa' && <MiniTarjeta datos={d} />}
              {!detalleVisible && nivel !== 'mapa' && x.lineas.length > 0 && (
                <div className="cn-res">
                  {x.lineas.map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              )}
              {detalleVisible && <div className="cn-det">{detalle(x.id)}</div>}
            </section>
          );
        })}

        {guardado.notas.map((nota) => (
          <section
            key={nota.id}
            className={[
              'cn-nodo nota',
              sel === nota.id ? 'sel' : '',
              conectando && conectando !== nota.id ? 'destino' : '',
              foco && foco !== nota.id ? 'apagado' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Nota"
            style={{ left: nota.x, top: nota.y, width: 240 }}
            onPointerDown={(e) => bajarNodo(e, nota.id)}
            onPointerMove={moverNodo}
            onPointerUp={soltarNodo}
            onPointerCancel={soltarNodo}
            onClick={() => conectando && tocarNodo(nota.id)}
          >
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: '#4A4210',
              }}
            >
              Nota
              <textarea
                className="cn-nota-texto"
                value={nota.texto}
                placeholder="Escribe una idea…"
                onChange={(e) =>
                  setGuardado((g) => ({
                    ...g,
                    notas: g.notas.map((x) =>
                      x.id === nota.id ? { ...x, texto: e.target.value } : x,
                    ),
                  }))
                }
              />
            </label>
            <div className="cn-ctl" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="cn-ic"
                title="Conectar"
                aria-label="Conectar la nota"
                onClick={() => setConectando(nota.id)}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M9.5 14.5l5-5" />
                  <path d="M11 6.5l1.6-1.6a4 4 0 0 1 5.6 5.6L16.6 12" />
                  <path d="M13 17.5l-1.6 1.6a4 4 0 0 1-5.6-5.6L7.4 12" />
                </svg>
              </button>
              <button
                type="button"
                className="cn-ic"
                title="Borrar nota"
                aria-label="Borrar la nota"
                onClick={() =>
                  setGuardado((g) => ({
                    ...g,
                    notas: g.notas.filter((x) => x.id !== nota.id),
                    hilos: g.hilos.filter(([a, b]) => a !== nota.id && b !== nota.id),
                  }))
                }
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
                </svg>
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="cn-arriba">
        <nav className="cn-miga" aria-label="Ubicación">
          <button type="button" onClick={verTodo}>
            {d.negocio.nombre}
          </button>
          {migaVisible && (
            <>
              <span aria-hidden="true">/</span>
              <b style={{ color: 'var(--cn-tinta)' }}>{tituloDe(sel)}</b>
            </>
          )}
        </nav>
        <div className="cn-der">
          <Paleta
            comandos={[...comandosMapa, ...comandos]}
            buscarClientes={enlace('/admin/lealtad/tarjetas')}
          />
          <form action={salir}>
            <button type="submit" className="salir">
              Salir
            </button>
          </form>
        </div>
      </div>

      {foco && (
        <div className="cn-foco" role="status">
          Enfoque: {tituloDe(foco)}
          <button type="button" onClick={() => setFoco(null)}>
            Salir
          </button>
        </div>
      )}

      <div className="cn-zoom" aria-label="Acercar y alejar">
        <button
          type="button"
          aria-label="Acercar"
          onClick={() =>
            setVista((v) => {
              const z = limitar(v.zoom * 1.25);
              const k = z / v.zoom;
              return { zoom: z, x: v.x * k, y: v.y * k };
            })
          }
        >
          +
        </button>
        <button
          type="button"
          aria-label="Alejar"
          onClick={() =>
            setVista((v) => {
              const z = limitar(v.zoom / 1.25);
              const k = z / v.zoom;
              return { zoom: z, x: v.x * k, y: v.y * k };
            })
          }
        >
          −
        </button>
      </div>

      <p className="cn-pista" aria-live="polite">
        {pista}
      </p>
    </div>
  );
}

/** La tarjeta del cliente con los colores del negocio, en pequeño. */
function MiniTarjeta({ datos }: { datos: DatosMapa }) {
  const c = datos.negocio.colores;
  const total = Math.min(datos.programa.posiciones, 12);
  const muestra = Math.max(1, Math.min(3, total - 1));
  const premio = datos.programa.hitos[datos.programa.hitos.length - 1];
  return (
    <div className="cn-tarjeta" style={{ background: c.fondo, color: c.sobre }}>
      <span style={{ fontSize: 12, opacity: 0.85 }}>Tu tarjeta</span>
      <span className="num">
        {muestra}{' '}
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          de {plural(datos.programa.posiciones, 'sello', 'sellos')}
        </span>
      </span>
      <span className="cn-puntos" style={{ color: c.acento }} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{ background: i < muestra ? c.acento : 'transparent' }} />
        ))}
      </span>
      {premio && <span style={{ fontSize: 13 }}>{premio.nombre}</span>}
    </div>
  );
}
