import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { enlaceWhatsAppServicio } from '@/lib/contacto';

import { PixelMeta } from './Medicion';
import { minimo } from './medidas';
import './sitio.css';

/**
 * Piezas del sitio del servicio (club-lealtad.com): marco con menú y pie, y
 * los bloques que repiten sus páginas. Los estilos viven en `sitio.css`,
 * todos bajo `.cl`.
 */

export const PAGINAS = [
  { ruta: '/como-funciona', nombre: 'Cómo funciona' },
  { ruta: '/negocios', nombre: 'Negocios' },
  { ruta: '/gamificacion', nombre: 'Gamificación' },
  { ruta: '/planes', nombre: 'Planes' },
  { ruta: '/guia', nombre: 'Guía' },
] as const;

/** WhatsApp de contacto: `WL_CONTACTO_WHATSAPP` o, si falta, el de Exkalibur. */
export function enlaceWhatsApp(): string {
  return enlaceWhatsAppServicio('Hola, quiero un programa de lealtad para mi negocio.');
}

export { minimo };

function Logo({ enlace }: { enlace: boolean }) {
  const contenido = (
    <>
      <span className="dot" aria-hidden="true" />
      club-lealtad
    </>
  );
  return enlace ? (
    <Link href="/" className="logo">
      {contenido}
    </Link>
  ) : (
    <span className="logo" style={{ minHeight: 0 }}>
      {contenido}
    </span>
  );
}

export function Marco({ actual, children }: { actual?: string; children: ReactNode }) {
  return (
    <div className="cl">
      <PixelMeta />
      <div className="bar" aria-hidden="true" />
      <header>
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
            <Logo enlace={false} />
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
            <span key={g} style={{ display: 'contents' }}>
              <span>{g}</span>
              <span className="mq-d" />
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
  children,
}: {
  etiqueta: string;
  titulo: string;
  texto: string;
  oscuro?: boolean;
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
      <div className="wrap col" style={{ gap: 24, paddingTop: 88, paddingBottom: 96 }}>
        <span className="chip">{etiqueta}</span>
        <h1 className="d h1" style={{ maxWidth: '11em' }}>
          {titulo}
        </h1>
        <p className="lead">{texto}</p>
        {children}
      </div>
    </section>
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
export function Revela({ titulo, pie, detras }: { titulo: string; pie: string; detras: string }) {
  return (
    <div className="rv rise" tabIndex={0}>
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
  items: readonly (readonly [string, string])[];
  min?: number;
}) {
  return (
    <ol className="grid" style={minimo(min, { margin: 0, padding: 0, listStyle: 'none', gap: 8 })}>
      {items.map(([titulo, texto], i) => (
        <li key={titulo} className="col step rise">
          <span className="num" aria-hidden="true">
            {i + 1}
          </span>
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
        <a href={enlaceWhatsApp()} className="btn inv">
          Escríbenos por WhatsApp
        </a>
      </div>
    </section>
  );
}
