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
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Gamificación',
  'Retos, rachas, niveles e insignias sobre tu tarjeta de sellos. Servicio adicional para programas Lite y Privada.',
);

const MECANICAS = [
  ['Retos', 'Mueve: frecuencia', '3 visitas en 30 días y tu siguiente estampa vale doble.'],
  ['Rachas', 'Mueve: constancia', 'Semanas seguidas con una visita. Romperla duele.'],
  ['Niveles', 'Mueve: permanencia', 'Bronce, Plata y Oro según las visitas del año.'],
  ['Insignias', 'Mueve: variedad y ticket', 'Probó tres panes nuevos. Visitó las dos sucursales.'],
  ['Referidos', 'Mueve: clientes nuevos', 'Invita a un amigo y los dos ganan una estampa.'],
  [
    'Ruleta y sorteos',
    'Mueve: días flojos',
    'Una sorpresa después de la visita. Revisamos contigo permisos y bases.',
  ],
] as const;

const OBJETIVOS = [
  ['Más visitas', 'Retos y rachas', 'Visitas por cliente al mes'],
  ['Llenar días flojos', 'Sello doble ese día', 'Visitas de ese día'],
  ['Clientes nuevos', 'Referidos', 'Tarjetas nuevas con visita'],
  ['Ticket más alto', 'Insignias por producto', 'Importe promedio'],
  ['Recuperar inactivos', 'Reto de regreso', 'Clientes que vuelven'],
] as const;

export default async function Gamificacion() {
  await exigirSitioDelServicio();
  return (
    <Marco actual="/gamificacion">
      <Hero
        oscuro
        etiqueta="Servicio adicional · Lite y Privada"
        titulo="Volver se siente como ganar"
        texto="Retos, rachas, niveles e insignias sobre tu tarjeta de sellos."
      >
        <a href={enlaceWhatsApp()} className="btn" style={{ alignSelf: 'flex-start' }}>
          Quiero gamificar mi club
        </a>
      </Hero>
      <Seccion>
        <h2 className="d h2 rise">Hábitos, no descuentos</h2>
        <Pasos
          items={[
            ['Progreso que se ve', 'Una barra a dos tercios pide terminarse.'],
            ['Metas cercanas', 'Tres visitas se sienten posibles hoy.'],
            ['Reconocimiento', 'Un nivel le dice a tu cliente que lo ves.'],
          ]}
        />
      </Seccion>
      <Seccion oscura>
        <div className="col" style={{ gap: 10 }}>
          <h2 className="d h2 rise">Las mecánicas</h2>
          <span className="sm2">Pasa el cursor para ver un ejemplo</span>
        </div>
        <div className="grid" style={minimo(300)}>
          {MECANICAS.map(([nombre, mueve, ejemplo]) => (
            <Revela key={nombre} titulo={nombre} pie={mueve} detras={ejemplo} />
          ))}
        </div>
      </Seccion>
      <Seccion separacion={32}>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          Empieza por lo que quieres mover
        </h2>
        <div className="panel rise" style={{ overflowX: 'auto', padding: 8 }}>
          <table className="tb">
            <thead>
              <tr>
                <th scope="col">Si quieres…</th>
                <th scope="col">Empieza con</th>
                <th scope="col">Medimos</th>
              </tr>
            </thead>
            <tbody>
              {OBJETIVOS.map(([objetivo, mecanica, medida]) => (
                <tr key={objetivo}>
                  <th scope="row">{objetivo}</th>
                  <td>{mecanica}</td>
                  <td>{medida}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
      <Seccion sinArriba separacion={32}>
        <h2 className="d h2 rise">Cómo lo montamos</h2>
        <Pasos
          min={240}
          items={[
            ['Medimos', 'Tu punto de partida.'],
            ['Elegimos', 'Una o dos mecánicas.'],
            ['Lanzamos', 'Con reglas de una línea.'],
            ['Comparamos', 'Si movió el número, se queda.'],
          ]}
        />
      </Seccion>
      <Cierre titulo="Dinos qué número quieres mover" />
    </Marco>
  );
}
