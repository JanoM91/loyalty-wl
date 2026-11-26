import { pesos, type GrupoGiro } from '@wl/domain';

import { precios } from '@/lib/precios';

import { Asistente } from './Asistente';
import { MedirAlCargar } from './Medicion';
import { Cierre, Cinta, Marco, Pasos, Seccion } from './Marco';

/**
 * Página de destino de la campaña: de un vistazo, qué es y el asistente a la
 * vista. Una por giro (`/belleza`, `/cafeterias`) y la general (`/empezar`).
 */
export async function PaginaAlta({
  ruta,
  grupo,
  etiqueta,
  titulo,
  texto,
  pasos,
}: {
  ruta: string;
  grupo?: GrupoGiro;
  etiqueta: string;
  titulo: string;
  texto: string;
  pasos: readonly (readonly [string, string])[];
}) {
  const { lite } = await precios();
  return (
    <Marco actual={ruta} compacto>
      <MedirAlCargar evento="ViewContent" datos={{ content_name: ruta.slice(1) }} />
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="orbs par" aria-hidden="true">
          <span className="orb a" style={{ width: 520, height: 520, left: -180, top: -200 }} />
          <span className="orb b s2" style={{ width: 180, height: 180, left: '40%', top: 20 }} />
          <span className="orb c s3" style={{ width: 110, height: 110, left: '28%', bottom: 30 }} />
        </div>
        {/* En el celular el asistente va en la primera pantalla: arriba solo
            queda el título, corto; lo demás se ve en pantallas anchas. */}
        <div className="wrap row alta-cuerpo" style={{ gap: 48, alignItems: 'flex-start' }}>
          <div
            className="col alta-intro"
            style={{ flex: '1 1 420px', minWidth: 0, gap: 22, paddingTop: 16 }}
          >
            <span className="chip solo-ancho">{etiqueta}</span>
            <h1 className="d h1 alta-h1">{titulo}</h1>
            <p className="lead solo-ancho">{texto}</p>
            <ul
              className="col solo-ancho"
              style={{ margin: 0, padding: 0, listStyle: 'none', gap: 8 }}
            >
              <li>
                <b>7 días gratis.</b> Sin tarjeta bancaria.
              </li>
              <li>
                <b>Con Juega y gana en la prueba:</b> juegos con tu marca que hacen volver a tus
                clientes.
              </li>
              {lite.mes !== null && (
                <li>
                  <b>{pesos(lite.mes)} al mes</b> después
                  {lite.anio !== null ? `, o ${pesos(lite.anio)} al año` : ''}. IVA incluido.
                </li>
              )}
              <li>
                <b>Sin app.</b> Tus clientes la guardan en su celular.
              </li>
            </ul>
          </div>
          <div className="col" style={{ flex: '1 1 380px', minWidth: 0, alignItems: 'center' }}>
            <Asistente grupo={grupo} origen={ruta.slice(1)} />
            <p className="p" style={{ fontSize: 15, marginTop: 14, textAlign: 'center' }}>
              ¿Ya tienes club?{' '}
              <a href="/entrar" className="ul">
                Entra a tu panel
              </a>
            </p>
          </div>
        </div>
      </section>
      <Cinta />
      <Seccion oscura>
        <h2 className="d h2 rise">Así de corto</h2>
        <Pasos min={280} items={pasos} />
      </Seccion>
      <Cierre titulo="¿Prefieres que lo armemos contigo?" />
    </Marco>
  );
}
