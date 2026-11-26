import { JUEGOS } from '@wl/domain';

import { ArcadeDemo } from '@/components/sitio/ArcadeDemo';
import { Burbuja, type NombreIconoSitio } from '@/components/sitio/Iconos';
import {
  Cierre,
  Hero,
  Marco,
  Pasos,
  Revela,
  Seccion,
  enlaceWhatsApp,
  minimo,
} from '@/components/sitio/Marco';
import { esJugable, INFO_JUEGOS } from '@/lib/arcade/motor';
import { precios, textoPrecio } from '@/lib/precios';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Juega y gana',
  'Juegos de habilidad dentro de la tarjeta de tus clientes, con tus productos y tus colores. Completan retos y ganan promociones que cobras en caja. Gratis en la prueba de 7 días; después, servicio adicional para Lite y Privada.',
);

/** Un ícono distinto por juego para que la lista no se vea repetida. */
const ICONO_JUEGO: Record<string, NombreIconoSitio> = {
  atrapa: 'rayo',
  memorama: 'estrella',
  asoma: 'diana',
  donde: 'pregunta',
  junta: 'niveles',
  sopa: 'papel',
};

const RETOS = [
  ['Juega 5 días esta semana', '10 % de descuento en tu siguiente visita', 'fuego'],
  ['Haz 800 puntos en una partida', 'Un producto de cortesía con tu compra', 'diana'],
  ['Juega 40 partidas este mes', '2x1 en tu siguiente compra', 'medalla'],
] as const;

export default async function JuegaYGana() {
  await exigirSitioDelServicio();
  const precio = textoPrecio((await precios()).arcade);
  const disponibles = JUEGOS.filter((j) => j.disponible);
  const pronto = JUEGOS.filter((j) => !j.disponible);
  return (
    <Marco actual="/gamificacion">
      <Hero
        iconos={['control', 'diana', 'regalo', 'fuego']}
        oscuro
        etiqueta="Servicio adicional · Gratis en la prueba"
        titulo="Juega y gana"
        texto="Tus clientes juegan en su tarjeta, con tus productos. Completan retos y ganan promociones que cobras en caja."
      >
        <div className="row" style={{ gap: '12px 26px' }}>
          <a href="#prueba" className="btn">
            Juega una partida
          </a>
          <a href={enlaceWhatsApp()} className="lk">
            Lo quiero en mi club
          </a>
        </div>
      </Hero>

      <section id="prueba" className="sec" style={{ scrollMarginTop: 24 }}>
        <div className="wrap col" style={{ gap: 36 }}>
          <div className="col" style={{ gap: 12 }}>
            <span className="chip">Pruébalo aquí</span>
            <h2 className="d h2 rise" style={{ maxWidth: '13em' }}>
              Juega como si fueras tu cliente
            </h2>
          </div>
          <ArcadeDemo />
        </div>
      </section>

      <Seccion oscura separacion={40}>
        <h2 className="d h2 rise">Cómo funciona</h2>
        <Pasos
          min={240}
          items={[
            [
              'Juegan',
              'Desde su tarjeta, sin app. Pocas partidas al día para que vuelvan mañana.',
              'control',
            ],
            [
              'Completan retos',
              'Días jugando, puntos o partidas en la semana o en el mes.',
              'diana',
            ],
            ['Ganan una promoción', 'Personal, con código y fecha para usarla.', 'regalo'],
            ['La cobras en caja', 'Tu caja la cobra con su código. Solo vale una vez.', 'escanear'],
          ]}
        />
      </Seccion>

      <Seccion separacion={36}>
        <div className="col" style={{ gap: 10 }}>
          <h2 className="d h2 rise">Los juegos</h2>
          <span className="sm2">Llevan tus colores, tu inicial y tus productos.</span>
        </div>
        <div className="grid" style={minimo(250)}>
          {disponibles.map((j) => (
            <Revela
              key={j.id}
              icono={ICONO_JUEGO[j.id] ?? 'control'}
              titulo={j.nombre}
              pie={j.dificultad}
              detras={esJugable(j.id) ? INFO_JUEGOS[j.id].como : j.nombre}
            />
          ))}
        </div>
        <p className="p">
          <b style={{ color: 'var(--ink)' }}>Próximamente:</b>{' '}
          {pronto.map((j) => j.nombre).join(', ')}.
        </p>
      </Seccion>

      <Seccion oscura separacion={40}>
        <div className="col" style={{ gap: 10 }}>
          <h2 className="d h2 rise">Retos y promociones</h2>
          <span className="sm2">Así vienen de inicio. Tú cambias metas y promociones.</span>
        </div>
        <div className="grid" style={minimo(280)}>
          {RETOS.map(([reto, promo, icono]) => (
            <div key={reto} className="col step rise" style={{ gap: 14 }}>
              <Burbuja nombre={icono} tono="pri" tam={52} />
              <h3 className="d h3">{reto}</h3>
              <p className="p" style={{ color: 'var(--dark-muted)' }}>
                Gana: {promo}
              </p>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion separacion={36}>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          Tú decides, desde tu panel
        </h2>
        <div className="grid" style={minimo(320)}>
          <Revela
            titulo="Qué juegos"
            pie="Todos o uno por semana"
            detras="Eliges cuáles. También puedes poner un juego distinto cada lunes."
          />
          <Revela
            titulo="Cuántas partidas"
            pie="Al día, por cliente"
            detras="Pocas partidas hacen que vuelvan cada día por la siguiente."
          />
          <Revela
            titulo="Retos y metas"
            pie="Por semana o por mes"
            detras="Las metas tienen un mínimo para que nadie gane con una sola partida."
          />
          <Revela
            titulo="Lista de la semana"
            pie="Ranking, rachas o al azar"
            detras="Solo muestra el nombre y la inicial del apellido. O ninguna lista."
          />
          <Revela
            icono="paleta"
            titulo="Tus productos"
            pie="Caen, se asoman y se juntan"
            detras="Cuatro dibujos con su nombre y las palabras de tu sopa de letras."
          />
          <Revela
            icono="grafica"
            titulo="Resultados"
            pie="En tu panel"
            detras="Partidas, jugadores, promociones ganadas y cobradas en caja."
          />
        </div>
      </Seccion>

      <Seccion oscura separacion={40}>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          Juego limpio
        </h2>
        <Pasos
          min={240}
          items={[
            [
              'Solo habilidad',
              'Sin ruleta, rasca y gana ni sorteos. Gana quien juega seguido y bien.',
              'candado',
            ],
            [
              'Puntajes revisados',
              'Una partida con un puntaje imposible para su tiempo no cuenta.',
              'escudo',
            ],
            ['Una por reto', 'Cada promoción se gana una vez por reto y por periodo.', 'ticket'],
            [
              'Contacto verificado',
              'Para cobrarla, tu cliente confirma su celular o su correo.',
              'check',
            ],
          ]}
        />
      </Seccion>

      <Seccion separacion={28}>
        <h2 className="d h2 rise">Cuánto cuesta</h2>
        <p className="lead">
          Viene incluido en los 7 días de prueba de tu club.{' '}
          {precio
            ? `Para seguir después, cuesta ${precio}, además de tu plan.`
            : 'Para seguir después, es un servicio adicional a tu plan: pregúntanos el precio por WhatsApp.'}{' '}
          Lo configuras en minutos.
        </p>
        <div className="row" style={{ gap: '12px 26px' }}>
          <a href="/empezar" className="btn">
            Crea tu club gratis
          </a>
          <a href={enlaceWhatsApp()} className="lk">
            Pregúntanos por WhatsApp
          </a>
        </div>
      </Seccion>

      <Cierre titulo="Dale a tus clientes un motivo para abrir tu tarjeta cada día" />
    </Marco>
  );
}
