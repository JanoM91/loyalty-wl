import Link from 'next/link';

import type { CSSProperties } from 'react';

import { precios, textoPrecio } from '@/lib/precios';

import { Burbuja, IconoSitio, type NombreIconoSitio } from './Iconos';
import { SelectorGiros, TarjetaDemo } from './Interactivos';
import { Cierre, Cinta, Marco, Pasos, Revela, Seccion, minimo } from './Marco';

/** Globo que flota junto a la tarjeta de ejemplo: lo que vive el cliente. */
function Globo({
  icono,
  texto,
  tono,
  lugar,
  clase = '',
}: {
  icono: NombreIconoSitio;
  texto: string;
  tono: 'pri' | 'pop' | 'tinte';
  lugar: CSSProperties;
  clase?: string;
}) {
  return (
    <span className={`pill flot ${clase}`} style={lugar} aria-hidden="true">
      <Burbuja nombre={icono} tono={tono} tam={30} />
      {texto}
    </span>
  );
}

const DUDAS: readonly [NombreIconoSitio, string, string][] = [
  [
    'celular',
    '¿Mis clientes descargan una app?',
    'No. La tarjeta abre en el navegador y se guarda en su pantalla de inicio.',
  ],
  ['escanear', '¿Cambio mi caja o punto de venta?', 'No. Se escanea desde un celular o tablet.'],
  [
    'ubicacion',
    '¿Sirve con varias sucursales?',
    'Sí. Una cuenta de caja por sucursal y la misma tarjeta en todas.',
  ],
  [
    'sobre',
    '¿Les puedo mandar promociones?',
    'Sí, por correo y solo a quienes aceptaron recibirlas. Uno al día como máximo, y se dan de baja con un toque.',
  ],
];

/** Inicio de club-lealtad.com: presenta el servicio a dueños de negocio. */
export async function Inicio() {
  const lite = textoPrecio((await precios()).lite);
  return (
    <Marco>
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="orbs par" aria-hidden="true">
          <span className="orb a" style={{ width: 520, height: 520, left: -180, top: -200 }} />
          <span className="orb b s2" style={{ width: 200, height: 200, left: '42%', top: 30 }} />
          <span className="orb c s3" style={{ width: 120, height: 120, left: '30%', bottom: 20 }} />
          <span className="orb b s3" style={{ width: 90, height: 90, right: '4%', bottom: 60 }} />
        </div>
        <div className="wrap row" style={{ gap: 56, paddingTop: 80, paddingBottom: 104 }}>
          <div className="col" style={{ flex: '1 1 520px', minWidth: 0, gap: 26 }}>
            <span className="chip">Lealtad digital, fácil</span>
            <h1 className="d h1">Tus clientes vuelven. Tú sabes quiénes son.</h1>
            <p className="lead">
              Tarjeta de sellos en su celular. Sin app. Sin papel. 7 días gratis.
            </p>
            <div className="row" style={{ gap: '12px 26px' }}>
              <Link href="/empezar" className="btn">
                Crea tu club gratis
              </Link>
              <Link href="/como-funciona" className="lk">
                Ver cómo funciona
              </Link>
            </div>
            <ul
              className="row"
              style={{ gap: '10px 22px', margin: 0, padding: 0, listStyle: 'none' }}
            >
              {(
                [
                  ['celular', 'Sin app'],
                  ['escanear', 'Se sella en segundos'],
                  ['regalo', 'Premios que tú eliges'],
                ] as const
              ).map(([icono, texto]) => (
                <li key={texto} className="row" style={{ gap: 8, fontWeight: 600 }}>
                  <IconoSitio nombre={icono} tam={22} style={{ color: 'var(--pri)' }} />
                  {texto}
                </li>
              ))}
            </ul>
          </div>
          <div className="hero-fig">
            <TarjetaDemo />
            <Globo icono="sello" texto="+1 sello" tono="pri" lugar={{ right: '-3%', top: '36%' }} />
            <Globo
              icono="regalo"
              texto="¡Premio listo!"
              tono="pop"
              lugar={{ left: '-3%', top: '62%' }}
              clase="f1"
            />
          </div>
        </div>
      </section>
      <Cinta />

      <Seccion separacion={44}>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          El cartón se pierde. Esto no.
        </h2>
        <div className="grid" style={minimo(240)}>
          <Revela
            icono="personas"
            titulo="No sabes quién vuelve"
            pie="Antes"
            detras="Cada tarjeta tiene nombre y celular. Ves quién viene y quién dejó de venir."
          />
          <Revela
            icono="escudo"
            titulo="Sellos de mentira"
            pie="Antes"
            detras="Cada sello se escanea en caja y queda registrado con el folio del ticket."
          />
          <Revela
            icono="dinero"
            titulo="Descuentos que duelen"
            pie="Antes"
            detras="Premias la costumbre de volver, no regalas tu margen."
          />
          <Revela
            icono="sobre"
            titulo="No les puedes escribir"
            pie="Antes"
            detras="Con su permiso, les mandas tu promoción por correo desde tu panel."
          />
        </div>
      </Seccion>

      <Seccion oscura separacion={40}>
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px 40px' }}
        >
          <h2 className="d h2 rise">Tres pasos</h2>
          <Link href="/como-funciona" className="lk">
            Recorrido completo
          </Link>
        </div>
        <Pasos
          min={300}
          items={[
            ['Saca su tarjeta', 'Con su celular, desde tu QR. Sin descargar nada.', 'celular'],
            ['Escaneas su QR', 'Tu caja sella la visita en segundos.', 'escanear'],
            ['Gana su premio', 'Ve «Premio listo» en su tarjeta y lo cobra en caja.', 'regalo'],
          ]}
        />
      </Seccion>

      <Seccion>
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px 40px' }}
        >
          <h2 className="d h2 rise" style={{ maxWidth: '11em' }}>
            Un club para cada negocio
          </h2>
          <Link href="/negocios" className="lk">
            Ver todos los giros
          </Link>
        </div>
        <SelectorGiros />
      </Seccion>

      <Seccion oscura separacion={40}>
        <div className="col" style={{ gap: 18 }}>
          <span className="chip">Servicio adicional</span>
          <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
            Juega y gana: un motivo para abrir tu tarjeta cada día
          </h2>
        </div>
        <div className="grid" style={minimo(240)}>
          <Revela
            icono="control"
            titulo="6 juegos"
            pie="Con tus productos"
            detras="Atrapa, Memorama, Asoma, ¿Dónde quedó?, Junta y Sopa de letras."
          />
          <Revela
            icono="diana"
            titulo="Retos"
            pie="Por semana o por mes"
            detras="5 días jugando, 800 puntos en una partida o 40 partidas al mes."
          />
          <Revela
            icono="regalo"
            titulo="Promociones"
            pie="Se cobran en caja"
            detras="Con código personal y fecha. Una vez por reto."
          />
          <Revela
            icono="medalla"
            titulo="Ranking"
            pie="Lista de la semana"
            detras="Los que más juegan, con su nombre y la inicial del apellido."
          />
        </div>
        <Link href="/gamificacion#prueba" className="btn" style={{ alignSelf: 'flex-start' }}>
          Juega una partida
        </Link>
      </Seccion>

      <Seccion separacion={40}>
        <h2 className="d h2 rise">Dos planes</h2>
        <div className="grid" style={minimo(380, { gap: 24 })}>
          <Link href="/planes" className="col plan rise" style={{ textDecoration: 'none' }}>
            <Burbuja nombre="rayo" tono="pri" tam={64} />
            <span className="d" style={{ fontSize: 54, fontWeight: 800 }}>
              Lite
            </span>
            <span className="p">
              Tu club en club-lealtad.com/tu-negocio. Tu logo, tus colores, tus premios.
            </span>
            <span className="lk" style={{ marginTop: 'auto' }}>
              Ver Lite
            </span>
          </Link>
          <Link href="/planes" className="col plan x rise" style={{ textDecoration: 'none' }}>
            <Burbuja nombre="corona" tono="pop" tam={64} />
            <span className="d" style={{ fontSize: 54, fontWeight: 800 }}>
              Privada
            </span>
            <span className="p">Tu dominio, diseño a la medida y acompañamiento.</span>
            <span className="lk" style={{ marginTop: 'auto' }}>
              Ver Privada
            </span>
          </Link>
        </div>
      </Seccion>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap col" style={{ maxWidth: 860, gap: 28 }}>
          <h2 className="d h2 rise">Dudas rápidas</h2>
          <div className="col" style={{ borderBottom: '1.5px solid var(--ink)' }}>
            {DUDAS.map(([icono, pregunta, respuesta]) => (
              <details key={pregunta} className="faq">
                <summary>
                  <IconoSitio nombre={icono} tam={26} />
                  {pregunta}
                </summary>
                <p>{respuesta}</p>
              </details>
            ))}
            <details className="faq">
              <summary>
                <IconoSitio nombre="dinero" tam={26} />
                ¿Cuánto cuesta?
              </summary>
              <p>
                {lite ? `Lite cuesta ${lite}, con IVA.` : 'Pregúntanos por WhatsApp.'} Los primeros
                7 días son gratis.
              </p>
            </details>
          </div>
        </div>
      </section>

      <Cierre titulo="Mira tu tarjeta con tu marca" />
    </Marco>
  );
}
