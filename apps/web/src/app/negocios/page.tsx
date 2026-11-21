import { negociosActivos } from '@wl/database';

import {
  Cierre,
  Cinta,
  Hero,
  Marco,
  Revela,
  Seccion,
  enlaceWhatsApp,
  minimo,
} from '@/components/sitio/Marco';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Negocios',
  'Un programa de lealtad para cada giro: cafeterías, panaderías, taquerías, barberías, restaurantes, bares, spas y más.',
);

const GIROS = [
  ['Cafetería', 'Café gratis', 'Juega y gana: 800 puntos en una partida y pan dulce de cortesía.'],
  ['Panadería', 'Pan y café', 'Juega y gana: 5 días jugando en la semana y café de cortesía.'],
  ['Taquería', 'Orden de tacos', 'Juega y gana: 40 partidas en el mes y 2x1 en tacos.'],
  [
    'Restaurante',
    'Postre de la casa',
    'Juega y gana: 800 puntos en una partida y postre de cortesía.',
  ],
  ['Bar', 'Coctel de la casa', 'Juega y gana: 5 días jugando en la semana y botana de cortesía.'],
  ['Barbería', 'Corte gratis', 'Juega y gana: 800 puntos en una partida y arreglo de barba.'],
  [
    'Spa y masajes',
    'Masaje de 30 min',
    'Juega y gana: 5 días jugando en la semana y 10 % en tu masaje.',
  ],
  [
    'Escuela de arte',
    'Clase para un amigo',
    'Juega y gana: 40 partidas en el mes y material de cortesía.',
  ],
] as const;

export default async function Negocios() {
  await exigirSitioDelServicio();
  // Los clubes creados desde el asistente no se publican aquí: nadie lo pidió
  // ni lo autorizó. Solo aparecen los que dio de alta Exkalibur.
  const negocios = (await negociosActivos()).filter((n) => n.ajustes.alta === null);
  return (
    <Marco actual="/negocios">
      <Hero
        iconos={['tienda', 'taza', 'tijeras', 'pan']}
        etiqueta="Negocios"
        titulo="Un club para cada giro"
        texto="Si tus clientes pueden volver, puedes premiarlos."
      />
      <Cinta />
      <Seccion>
        <div className="col" style={{ gap: 10 }}>
          <h2 className="d h2 rise">¿Cuál es el tuyo?</h2>
          <span className="sm2">Ejemplos de premio y de juego. Tú decides los tuyos.</span>
        </div>
        <div className="grid" style={minimo(250)}>
          {GIROS.map(([giro, premio, juego]) => (
            <Revela key={giro} titulo={giro} pie={premio} detras={juego} />
          ))}
        </div>
      </Seccion>
      <Seccion oscura>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          Negocios con su club
        </h2>
        <div className="grid" style={minimo(230)}>
          {negocios.map((n) => (
            <a
              key={n.slug}
              href={`/${n.slug}`}
              className="tile rise"
              style={{ borderColor: 'var(--dark-muted)' }}
            >
              {n.nombre}
            </a>
          ))}
          <a href={enlaceWhatsApp()} className="tile go rise">
            Tu negocio aquí
          </a>
        </div>
      </Seccion>
      <Cierre titulo="¿No ves tu giro? Lo armamos" />
    </Marco>
  );
}
