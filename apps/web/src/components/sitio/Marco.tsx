import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { enlaceWhatsAppServicio } from '@/lib/contacto';

import { Burbuja, IconoSitio, iconoPara, type NombreIconoSitio } from './Iconos';
import { PixelMeta } from './Medicion';
import { minimo } from './medidas';
import '@fontsource-variable/fredoka';
import './sitio.css';

/**
 * Piezas del sitio del servicio (club-lealtad.com): marco con menú y pie, y
 * los bloques que repiten sus páginas. Los estilos viven en `sitio.css`,
 * todos bajo `.cl`.
 */

export const PAGINAS = [
  { ruta: '/como-funciona', nombre: 'Cómo funciona' },
  { ruta: '/negocios', nombre: 'Negocios' },
  { ruta: '/gamificacion', nombre: 'Juega y gana' },
  { ruta: '/planes', nombre: 'Planes' },
  { ruta: '/guia', nombre: 'Guía' },
] as const;

/** WhatsApp de contacto: `WL_CONTACTO_WHATSAPP` o, si falta, el de Exkalibur. */
export function enlaceWhatsApp(): string {
  return enlaceWhatsAppServicio('Hola, quiero un programa de lealtad para mi negocio.');
}

export { minimo };

/**
 * Isotipo de club-lealtad («Tarjeta negra», versión reducida para tamaños
 * chicos): tarjeta negra con filo lima, tres sellos y el premio en coral,
 * con otra tarjeta coral detrás. Los archivos de la marca están en `marca/`.
 */
export function Isotipo({ tam = 36, oscuro = false }: { tam?: number; oscuro?: boolean }) {
  return (
    <svg className="iso" width={tam} height={tam} viewBox="0 0 100 100" aria-hidden="true">
      <rect
        x="20"
        y="18"
        width="64"
        height="44"
        rx="10"
        fill="#FF5B3A"
        transform="rotate(10 52 40)"
      />
      <g transform="rotate(-7 49 56)">
        <rect
          x="12.9"
          y="30.9"
          width="72.2"
          height="50.2"
          rx="10.2"
          fill={oscuro ? '#1E1440' : '#120A2A'}
          stroke="#C6FF3D"
          strokeWidth="1.8"
        />
        <rect x="29" y="36" width="17" height="17" rx="4.5" fill="#C6FF3D" />
        <rect x="52" y="36" width="17" height="17" rx="4.5" fill="#C6FF3D" />
        <rect x="29" y="59" width="17" height="17" rx="4.5" fill="#C6FF3D" />
        <rect className="pr" x="52" y="59" width="17" height="17" rx="4.5" fill="#FF5B3A" />
      </g>
    </svg>
  );
}

function Logo({ enlace, oscuro = false }: { enlace: boolean; oscuro?: boolean }) {
  const contenido = (
    <>
      <Isotipo oscuro={oscuro} />
      <span className="wm" aria-hidden="true">
        club
        <span className="px" />
        lealtad
      </span>
    </>
  );
  return enlace ? (
    <Link href="/" className="logo" aria-label="club-lealtad, inicio">
      {contenido}
    </Link>
  ) : (
    <span className="logo" role="img" aria-label="club-lealtad" style={{ minHeight: 0 }}>
      {contenido}
    </span>
  );
}

export function Marco({
  actual,
  compacto = false,
  children,
}: {
  actual?: string;
  /** En el celular, el encabezado queda en una línea: logo y «Entrar». */
  compacto?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="cl">
      <PixelMeta />
      <div className="bar" aria-hidden="true" />
      <header className={compacto ? 'cab-compacta' : undefined}>
        <div
          className="wrap row"
          style={{
            justifyContent: 'space-between',
            gap: '8px 28px',
            paddingTop: 14,
            paddingBottom: 14,
          }}
        >
          <Logo enlace />
          <nav aria-label="Principal" className="row" style={{ gap: '4px 26px' }}>
            {PAGINAS.map((p) => (
              <Link
                key={p.ruta}
                href={p.ruta}
                className={p.ruta === actual ? 'nl cur' : 'nl'}
                aria-current={p.ruta === actual ? 'page' : undefined}
              >
                {p.nombre}
              </Link>
            ))}
            <Link
              href="/entrar"
              className={actual === '/entrar' ? 'nl cur siempre' : 'nl siempre'}
              aria-current={actual === '/entrar' ? 'page' : undefined}
            >
              Entrar
            </Link>
            <Link href="/empezar" className="btn sm">
              Prueba gratis
            </Link>
          </nav>
        </div>
      </header>
      <main id="contenido">{children}</main>
      <footer className="dk">
        <div
          className="wrap row"
          style={{
            justifyContent: 'space-between',
            gap: '20px 48px',
            paddingTop: 44,
            paddingBottom: 44,
            fontSize: 15,
          }}
        >
          <div className="col" style={{ gap: 4 }}>
            <Logo enlace={false} oscuro />
            <span style={{ color: 'var(--dark-muted)' }}>
              Un servicio de Exkalibur Consulting · Xalapa, Veracruz
            </span>
          </div>
          <nav aria-label="Pie de página" className="row" style={{ gap: '4px 22px' }}>
            <Link href="/" className="nl">
              Inicio
            </Link>
            {PAGINAS.map((p) => (
              <Link key={p.ruta} href={p.ruta} className="nl">
                {p.nombre}
              </Link>
            ))}
            <Link href="/entrar" className="nl">
              Entrar a mi panel
            </Link>
            <Link href="/terminos" className="nl">
              Términos
            </Link>
            <Link href="/privacidad" className="nl">
              Privacidad
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

const GIROS = [
  'Cafeterías',
  'Panaderías',
  'Taquerías',
  'Barberías',
  'Restaurantes',
  'Bares',
  'Spas',
  'Escuelas de arte',
];

/** Cinta de giros que corre sola y se detiene con el cursor. */
export function Cinta() {
  return (
    <div className="mq">
      {[0, 1, 2].map((copia) => (
        <div key={copia} className="mq-t" aria-hidden={copia > 0 ? true : undefined}>
          {GIROS.map((g) => (
            <span key={g} className="mq-g">
              <IconoSitio nombre={iconoPara(g)} tam={30} className="mq-i" />
              <span>{g}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Hero({
  etiqueta,
  titulo,
  texto,
  oscuro = false,
  iconos,
  children,
}: {
  etiqueta: string;
  titulo: string;
  texto: string;
  oscuro?: boolean;
  /** Figura a la derecha: el primero va grande y los demás flotan alrededor. */
  iconos?: readonly NombreIconoSitio[];
  children?: ReactNode;
}) {
  return (
    <section
      className={oscuro ? 'dk' : undefined}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {oscuro ? (
        <div className="dots" aria-hidden="true" />
      ) : (
        <div className="orbs par" aria-hidden="true">
          <span className="orb a" style={{ width: 420, height: 420, right: -120, top: -160 }} />
          <span className="orb b s2" style={{ width: 160, height: 160, right: '30%', top: 40 }} />
          <span className="orb c s3" style={{ width: 90, height: 90, left: '6%', bottom: 30 }} />
        </div>
      )}
      <div className="wrap row" style={{ gap: 40, paddingTop: 88, paddingBottom: 96 }}>
        <div className="col" style={{ gap: 24, flex: '1 1 560px', minWidth: 0 }}>
          <span className="chip">{etiqueta}</span>
          <h1 className="d h1" style={{ maxWidth: '11em' }}>
            {titulo}
          </h1>
          <p className="lead">{texto}</p>
          {children}
        </div>
        {iconos && iconos.length > 0 ? <Figura iconos={iconos} /> : null}
      </div>
    </section>
  );
}

/** Composición de íconos para la portada de una página: uno grande y tres que flotan. */
export function Figura({ iconos }: { iconos: readonly NombreIconoSitio[] }) {
  const [principal, ...resto] = iconos;
  const lugares: CSSProperties[] = [
    { left: '4%', top: '8%' },
    { right: '2%', top: '30%' },
    { left: '16%', bottom: '4%' },
  ];
  const tonos = ['pop', 'blanco', 'tinte'] as const;
  return (
    <div className="fig" aria-hidden="true">
      <span className="fig-anillo" />
      <span className="fig-centro">
        <Burbuja nombre={principal ?? 'estrella'} tono="pri" tam={148} />
      </span>
      {resto.slice(0, 3).map((n, i) => (
        <span key={n} className={`fig-sat flot f${i}`} style={lugares[i]}>
          <Burbuja nombre={n} tono={tonos[i]} tam={68} />
        </span>
      ))}
    </div>
  );
}

/** Sección con ancho de página. `oscura` le pone el fondo de puntos en movimiento. */
export function Seccion({
  oscura = false,
  sinArriba = false,
  separacion = 36,
  children,
}: {
  oscura?: boolean;
  sinArriba?: boolean;
  separacion?: number;
  children: ReactNode;
}) {
  return (
    <section
      className={oscura ? 'sec dk' : 'sec'}
      style={{ overflow: 'hidden', ...(sinArriba ? { paddingTop: 0 } : null) }}
    >
      {oscura ? <div className="dots" aria-hidden="true" /> : null}
      <div className="wrap col" style={{ gap: separacion }}>
        {children}
      </div>
    </section>
  );
}

/** Tarjeta que revela su reverso al pasar el cursor o al recibir el foco. */
export function Revela({
  titulo,
  pie,
  detras,
  icono,
}: {
  titulo: string;
  pie: string;
  detras: string;
  /** Si no se da, se elige por las palabras del título. */
  icono?: NombreIconoSitio;
}) {
  return (
    <div className="rv rise" tabIndex={0}>
      <Burbuja nombre={icono ?? iconoPara(titulo, pie)} />
      <h3 className="d h3">{titulo}</h3>
      <span className="sm2">{pie}</span>
      <div className="back">
        <span className="sm2">{titulo}</span>
        <span>{detras}</span>
      </div>
    </div>
  );
}

export function Pasos({
  items,
  min = 280,
}: {
  /** Título, texto y, si se quiere, el ícono (si no, se elige por las palabras). */
  items: readonly (readonly [string, string] | readonly [string, string, NombreIconoSitio])[];
  min?: number;
}) {
  return (
    <ol className="grid" style={minimo(min, { margin: 0, padding: 0, listStyle: 'none', gap: 8 })}>
      {items.map(([titulo, texto, icono], i) => (
        <li key={titulo} className="col step rise">
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span className="num" aria-hidden="true">
              {i + 1}
            </span>
            <Burbuja nombre={icono ?? iconoPara(titulo, texto)} tam={52} />
          </div>
          <h3 className="d h3">{titulo}</h3>
          <p className="p">{texto}</p>
        </li>
      ))}
    </ol>
  );
}

/** Banda final con el botón de contacto. */
export function Cierre({ titulo }: { titulo: string }) {
  const trazo: CSSProperties = { border: '3px dashed currentColor', opacity: 0.35 };
  return (
    <section className="band" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="orbs" aria-hidden="true">
        <span
          className="orb s2"
          style={{ width: 300, height: 300, left: -80, top: -120, ...trazo }}
        />
        <span
          className="orb s3"
          style={{ width: 180, height: 180, right: '12%', bottom: -70, ...trazo }}
        />
      </div>
      <div
        className="wrap row"
        style={{
          justifyContent: 'space-between',
          gap: '28px 56px',
          paddingTop: 88,
          paddingBottom: 88,
        }}
      >
        <h2 className="d h2 rise" style={{ flex: '1 1 480px', minWidth: 0 }}>
          {titulo}
        </h2>
        <a href={enlaceWhatsApp()} className="btn inv" style={{ gap: 10 }}>
          <IconoSitio nombre="whatsapp" tam={22} />
          Escríbenos por WhatsApp
        </a>
      </div>
    </section>
  );
}
