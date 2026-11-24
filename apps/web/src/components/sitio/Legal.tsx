import type { ReactNode } from 'react';

import { MEDICION_ACTIVA } from '@/lib/medicion';

/**
 * Titular del servicio club-lealtad y piezas de sus páginas legales
 * (`/terminos` y `/privacidad`).
 *
 * **Plantillas para revisión de abogado.** Describen lo que la plataforma
 * hace hoy con los datos y las reglas comerciales que Jano decidió el 21 de
 * noviembre de 2026. Si cambia una regla (precio, prueba, borrado) o se suma
 * un proveedor o una medición (pixel de Meta), hay que actualizar el texto y
 * la fecha de `VERSION_LEGAL`.
 */

export const TITULAR = {
  nombre: 'Alejandro Ortiz Montano',
  nombreComercial: 'club-lealtad',
  domicilio: 'Macedonia 18, Imperial Animas, C.P. 91195, Xalapa, Veracruz, México',
  correoPrivacidad: 'alejandro.ortiz@exkalibur.mx',
  sitio: 'club-lealtad.com',
} as const;

/**
 * Fecha de la versión vigente de términos y aviso. Con el pixel de Meta
 * encendido el aviso cambia (apartados 3, 5 y 8), así que la versión también.
 * `FECHA_MEDICION` es el día en que se encendió: si el texto de la medición
 * cambia, se actualiza aquí.
 */
const FECHA_BASE = '21 de noviembre de 2026';
const FECHA_MEDICION = '23 de noviembre de 2026';

export const VERSION_LEGAL = MEDICION_ACTIVA
  ? `${FECHA_MEDICION}, con medición de Meta`
  : FECHA_BASE;

export function Documento({
  titulo,
  entrada,
  children,
}: {
  titulo: string;
  entrada: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="sec" style={{ paddingTop: 72 }}>
      <article
        className="wrap col"
        style={{ gap: 36, maxWidth: 780, fontSize: 17, lineHeight: 1.6 }}
      >
        <header className="col" style={{ gap: 14 }}>
          <span className="chip" style={{ alignSelf: 'flex-start' }}>
            Versión del {VERSION_LEGAL}
          </span>
          <h1 className="d h2">{titulo}</h1>
          <div className="p" style={{ fontSize: 19 }}>
            {entrada}
          </div>
        </header>
        {children}
      </article>
    </section>
  );
}

export function Apartado({
  id,
  titulo,
  children,
}: {
  id?: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="col" style={{ gap: 12, scrollMarginTop: 24 }}>
      <h2 className="d h3">{titulo}</h2>
      <div className="col legal" style={{ gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

export function Correo() {
  return (
    <a href={`mailto:${TITULAR.correoPrivacidad}`} className="ul">
      {TITULAR.correoPrivacidad}
    </a>
  );
}
