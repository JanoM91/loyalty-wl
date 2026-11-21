import {
  Cierre,
  Hero,
  Marco,
  Revela,
  Seccion,
  enlaceWhatsApp,
  minimo,
} from '@/components/sitio/Marco';
import { pesos, type PrecioPeriodo } from '@wl/domain';

import { precios } from '@/lib/precios';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Planes',
  'Lite: tu club dentro de club-lealtad.com. Privada: tu propio dominio, diseño a la medida y acompañamiento.',
);

const planes = (lite: PrecioPeriodo) =>
  [
    {
      nombre: 'Lite',
      precio: lite.mes !== null ? `${pesos(lite.mes)} al mes` : 'Pregúntanos',
      nota: `${lite.anio !== null ? `o ${pesos(lite.anio)} al año. ` : ''}IVA incluido. 7 días gratis.`,
      oscuro: false,
      incluye: [
        'club-lealtad.com/tu-negocio',
        'Tu logo, colores y premios',
        '20 combinaciones de color',
        'Apple Wallet y Google Wallet',
        'Campañas y reportes los llevamos nosotros',
      ],
    },
    {
      nombre: 'Privada',
      precio: 'Cotización en la demo',
      nota: 'Según tu marca y tus sucursales.',
      oscuro: true,
      incluye: [
        'Tu propio dominio y página de inicio',
        'Diseño a la medida',
        'Instalación solo para ti',
        'Apple Wallet y Google Wallet',
        'Campañas, reportes completos y acompañamiento',
      ],
    },
  ] as const;

const COMPARA = [
  ['Dirección', 'club-lealtad.com/tu-negocio', 'Tu dominio'],
  ['Diseño', 'Plantillas y colores', 'A la medida'],
  ['Campañas', 'Las lleva Exkalibur', 'Abiertas para ti'],
  ['Reportes', 'Esenciales', 'Completos'],
  ['Datos', 'Compartida, aislados', 'Solo tuyos'],
  ['Gamificación', 'Servicio adicional', 'Servicio adicional'],
] as const;

export default async function Planes() {
  await exigirSitioDelServicio();
  const whatsapp = enlaceWhatsApp();
  const PLANES = planes((await precios()).lite);
  return (
    <Marco actual="/planes">
      <Hero
        iconos={['dinero', 'rayo', 'corona', 'check']}
        etiqueta="Planes"
        titulo="Lite para arrancar. Privada para hacerlo tuyo."
        texto="El mismo programa. Cambia cuánto se personaliza."
      />
      <section className="sec" style={{ paddingTop: 24 }}>
        <div className="wrap grid" style={minimo(390, { gap: 24 })}>
          {PLANES.map((p) => (
            <div key={p.nombre} className={p.oscuro ? 'col plan x rise' : 'col plan rise'}>
              <span className="d" style={{ fontSize: 60, fontWeight: 800 }}>
                {p.nombre}
              </span>
              <b className="d h3">{p.precio}</b>
              <span className="p">{p.nota}</span>
              <ul>
                {p.incluye.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <a
                href={p.oscuro ? whatsapp : '/empezar'}
                className="btn"
                style={{ marginTop: 'auto' }}
              >
                {p.oscuro ? 'Quiero Privada' : 'Probar Lite gratis'}
              </a>
            </div>
          ))}
        </div>
      </section>
      <Seccion sinArriba separacion={32}>
        <h2 className="d h2 rise">Lado a lado</h2>
        <div className="panel rise" style={{ overflowX: 'auto', padding: 8 }}>
          <table className="tb">
            <thead>
              <tr>
                <td />
                <th scope="col" className="d h3">
                  Lite
                </th>
                <th scope="col" className="d h3">
                  Privada
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARA.map(([tema, lite, privada]) => (
                <tr key={tema}>
                  <th scope="row">{tema}</th>
                  <td>{lite}</td>
                  <td>{privada}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
      <Seccion oscura>
        <h2 className="d h2 rise">¿Cuál te conviene?</h2>
        <div className="grid" style={minimo(320)}>
          <Revela
            titulo="Lite"
            pie="Quiero empezar ya"
            detras="Dejas el cartón esta semana y nosotros llevamos campañas y reportes."
          />
          <Revela
            titulo="Privada"
            pie="Mi marca ya pesa"
            detras="Varias sucursales, tu sitio, un diseño que nadie más tiene."
          />
          <Revela
            titulo="Empezar en Lite"
            pie="Y crecer después"
            detras="Pasas a Privada cuando quieras. La migración la planeamos contigo."
          />
        </div>
      </Seccion>
      <Cierre titulo="Lo decidimos juntos en la demo" />
    </Marco>
  );
}
