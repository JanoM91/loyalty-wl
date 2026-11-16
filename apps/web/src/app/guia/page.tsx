import Link from 'next/link';

import { Cierre, Hero, Marco, Pasos, Revela, Seccion, minimo } from '@/components/sitio/Marco';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Guía de lealtad',
  '¿Bastan los sellos para fidelizar? Sellos o puntos, cinco reglas de un programa que sí se usa y qué medir cada mes.',
);

const CIFRAS = [
  ['5 veces', 'más cuesta un cliente nuevo que conservar uno.', 'BonusQR'],
  ['+5 %', 'de retención puede subir utilidades hasta 25 %.', 'BonusQR'],
  ['15–25 %', 'más ingresos de clientes recurrentes.', 'EY, vía La República'],
] as const;

const MEDIR = [
  ['Tarjetas nuevas', 'Inscripción', '¿Tu equipo está invitando?'],
  ['Visitas por cliente', 'Frecuencia', '¿Vienen más seguido que antes?'],
  ['Premios canjeados', 'Atractivo', '¿El premio se alcanza y se quiere?'],
  ['Inactivos', 'Recuperación', '¿A quién invitas de regreso?'],
  ['Gasto por visita', 'Ticket', 'Para eso se anota el folio.'],
] as const;

const FUENTES = [
  [
    'BonusQR: guía de programas de lealtad',
    'https://bonusqr.com/article/the-ultimate-guide-to-free-loyalty-programs-for-small-businesses',
  ],
  [
    'Loop: apps de lealtad para pequeños negocios',
    'https://loop.fans/blog/free-loyalty-program-app',
  ],
  [
    'La República: estudio de EY',
    'https://www.larepublica.co/consumo/programas-de-fidelidad-aumentan-las-ventas-en-las-empresas-4397978',
  ],
] as const;

export default async function Guia() {
  await exigirSitioDelServicio();
  return (
    <Marco actual="/guia">
      <Hero
        etiqueta="Guía para dueños"
        titulo="¿Bastan los sellos para fidelizar?"
        texto="No. Son el motivo para volver. Lo demás es hacerlo fácil y usar lo que aprendes."
      />
      <Seccion oscura>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          Cuida al cliente que ya tienes
        </h2>
        <div className="grid" style={minimo(290, { gap: 36 })}>
          {CIFRAS.map(([cifra, texto, fuente]) => (
            <div key={cifra} className="col stat rise">
              <b>{cifra}</b>
              <span>{texto}</span>
              <span className="sm2">{fuente}</span>
            </div>
          ))}
        </div>
      </Seccion>
      <Seccion>
        <h2 className="d h2 rise">Sellos o puntos</h2>
        <div className="grid" style={minimo(380, { gap: 24 })}>
          <div className="col plan rise">
            <span className="d" style={{ fontSize: 44, fontWeight: 800 }}>
              Sellos
            </span>
            <span className="p">
              «Ocho visitas y el siguiente va por la casa». Para compras frecuentes y tickets
              parecidos.
            </span>
            <b>Así opera Club Lealtad.</b>
          </div>
          <div className="col plan rise">
            <span className="d" style={{ fontSize: 44, fontWeight: 800 }}>
              Puntos
            </span>
            <span className="p">
              Puntos por cada peso. Premia a quien gasta más. Para tickets muy distintos.
            </span>
            <span className="p">Pide más explicación en caja.</span>
          </div>
        </div>
      </Seccion>
      <Seccion sinArriba separacion={32}>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          Cinco reglas de un club que sí se usa
        </h2>
        <Pasos
          min={210}
          items={[
            ['Una frase', 'Se explica en cinco segundos.'],
            ['Premio pronto', 'Entre la visita 4 y la 8.'],
            ['Premio listo', 'Vale mucho para él, poco para ti.'],
            ['Tu equipo invita', 'En cada cobro, el primer mes.'],
            ['QR a la vista', 'Donde se paga y en tus redes.'],
          ]}
        />
      </Seccion>
      <Seccion oscura>
        <h2 className="d h2 rise">Qué medir cada mes</h2>
        <div className="grid" style={minimo(210)}>
          {MEDIR.map(([que, tema, pregunta]) => (
            <Revela key={que} titulo={que} pie={tema} detras={pregunta} />
          ))}
        </div>
        <Link href="/gamificacion" className="btn" style={{ alignSelf: 'flex-start' }}>
          Después de los sellos: gamificación
        </Link>
      </Seccion>
      <section style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="wrap col" style={{ gap: 2, fontSize: 15 }}>
          <b>Fuentes</b>
          {FUENTES.map(([nombre, direccion]) => (
            <a key={direccion} className="lk" style={{ fontWeight: 500 }} href={direccion}>
              {nombre}
            </a>
          ))}
        </div>
      </section>
      <Cierre titulo="Arma tu club con estas reglas" />
    </Marco>
  );
}
