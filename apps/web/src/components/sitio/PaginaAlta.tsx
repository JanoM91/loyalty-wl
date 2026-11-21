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
    <Marco actual={ruta}>
      <MedirAlCargar evento="ViewContent" datos={{ content_name: ruta.slice(1) }} />
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="orbs par" aria-hidden="true">
          <span className="orb a" style={{ width: 520, height: 520, left: -180, top: -200 }} />
          <span className="orb b s2" style={{ width: 180, height: 180, left: '40%', top: 20 }} />
          <span className="orb c s3" style={{ width: 110, height: 110, left: '28%', bottom: 30 }} />
        </div>
        <div
          className="wrap row"
          style={{ gap: 48, paddingTop: 64, paddingBottom: 88, alignItems: 'flex-start' }}
        >
          <div className="col" style={{ flex: '1 1 420px', minWidth: 0, gap: 22, paddingTop: 16 }}>
            <span className="chip">{etiqueta}</span>
            <h1 className="d h1">{titulo}</h1>
            <p className="lead">{texto}</p>
            <ul className="col" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 8 }}>
              <li>
                <b>7 días gratis.</b> Sin tarjeta bancaria.
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
