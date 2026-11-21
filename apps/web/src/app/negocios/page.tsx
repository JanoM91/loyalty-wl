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
  ['Cafetería', 'Café gratis', 'Reto: 3 visitas en 30 días y tu estampa vale doble.'],
  ['Panadería', 'Pan y café', 'Insignia por probar tres panes nuevos.'],
  ['Taquería', 'Orden de tacos', 'Martes de sello doble para llenar el día flojo.'],
  ['Restaurante', 'Postre de la casa', 'Sello doble entre semana.'],
  ['Bar', 'Coctel de la casa', 'Racha de jueves: cuatro seguidos y hay premio.'],
  ['Barbería', 'Corte gratis', 'Trae a un amigo: sello para los dos.'],
  ['Spa y masajes', 'Masaje de 30 min', 'Nivel Oro: prioridad para agendar.'],
  ['Escuela de arte', 'Clase para un amigo', 'Insignia por cada taller terminado.'],
] as const;

export default async function Negocios() {
  await exigirSitioDelServicio();
  // Los clubes creados desde el asistente no se publican aquí: nadie lo pidió
  // ni lo autorizó. Solo aparecen los que dio de alta Exkalibur.
  const negocios = (await negociosActivos()).filter((n) => n.ajustes.alta === null);
  return (
    <Marco actual="/negocios">
      <Hero
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
