import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { negocioPorSlug, programaVigente, conNegocio } from '@wl/database';
import { diasRestantesDePrueba } from '@wl/domain';

import { Copiar } from '@/components/Copiar';
import { ArribaAlCargar } from '@/components/sitio/ArribaAlCargar';
import { Marco } from '@/components/sitio/Marco';
import { MedirAlCargar } from '@/components/sitio/Medicion';
import { fechaLarga } from '@/lib/lealtad/formato';
import { origenDeLaPeticion } from '@/lib/negocio';
import { precios } from '@/lib/precios';
import { exigirSitioDelServicio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Tu club está listo | Club Lealtad' },
  robots: { index: false, follow: false },
};

/**
 * Pantalla final del asistente: el club ya existe y el dueño ya tiene sesión
 * en su panel. Solo celebra y lo lleva adentro; los primeros pasos viven en
 * el inicio del panel.
 */
export default async function Listo({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; 'sin-sesion'?: string }>;
}) {
  await exigirSitioDelServicio();
  const { n, 'sin-sesion': sinSesion } = await searchParams;
  const negocio = n ? await negocioPorSlug(n) : null;
  // Solo clubes creados desde el asistente: no se asoma a ningún otro negocio.
  if (!negocio || !negocio.ajustes.alta) notFound();

  const programa = await conNegocio(negocio, () => programaVigente());
  const hito = programa.hitos[programa.hitos.length - 1];
  const panel = `${await origenDeLaPeticion()}/${negocio.slug}/admin`;
  const vence = negocio.ajustes.pruebaVence;
  const dias = diasRestantesDePrueba(vence);
  const { fondo, sobreFondo, acento } = negocio.marca.colores;

  return (
    <Marco>
      <ArribaAlCargar />
      {/* Alta completa: lo que optimiza la campaña. Una vez por club. */}
      <MedirAlCargar
        evento={['CompleteRegistration', 'StartTrial']}
        datos={{
          content_name: negocio.ajustes.alta.origen || 'empezar',
          currency: 'MXN',
          value: 0,
          predicted_ltv: (await precios()).lite.anio ?? 0,
        }}
        unaVez={`alta-${negocio.slug}`}
      />
      <section className="sec" style={{ paddingTop: 56 }}>
        <div className="wrap col" style={{ maxWidth: 620, gap: 24 }}>
          {dias > 0 && vence ? (
            <span className="chip rise">Prueba gratis hasta el {fechaLarga(new Date(vence))}</span>
          ) : null}
          <h1 className="d h2 rise">{negocio.nombre} ya tiene su club.</h1>

          <div
            className="pv rise"
            style={{ background: fondo, color: sobreFondo, maxWidth: 460 }}
            aria-hidden="true"
          >
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
              <span className="d h3">{negocio.nombre}</span>
              <span className="sm2">Así se ve</span>
            </div>
            <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
              <span className="big" style={{ fontSize: 64 }}>
                1
              </span>
              <span style={{ fontWeight: 600 }}>de {programa.posiciones} sellos</span>
            </div>
            <div className="pvs">
              {Array.from({ length: programa.posiciones }, (_, i) => (
                <span
                  key={i}
                  className={i === 0 ? 'pvd sello-cae' : 'pvd'}
                  style={i === 0 ? { background: acento, borderColor: acento } : undefined}
                />
              ))}
            </div>
            {hito ? <span style={{ fontWeight: 600 }}>{hito.nombre}</span> : null}
          </div>

          <p className="lead" style={{ fontSize: 19 }}>
            {sinSesion
              ? 'Entra con tu correo y la contraseña que elegiste. Adentro te esperan 3 pasos cortos para estrenarlo con tu primer cliente: tú.'
              : 'Ya entraste a tu panel. Te faltan 3 pasos cortos para estrenarlo con tu primer cliente: tú.'}
          </p>

          <a
            href={sinSesion ? `/${negocio.slug}/admin/entrar` : `/${negocio.slug}/admin`}
            className="btn"
            style={{ alignSelf: 'flex-start' }}
          >
            {sinSesion ? 'Entrar a mi panel' : 'Ir a mi panel'}
          </a>

          <div className="panel col" style={{ gap: 10, padding: 22, boxShadow: 'none' }}>
            <span className="p" style={{ fontSize: 15 }}>
              La dirección de tu panel. Guárdala o agrégala a la pantalla de inicio de tu celular.
            </span>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <b style={{ wordBreak: 'break-all', flex: '1 1 220px' }}>
                {panel.replace(/^https?:\/\//, '')}
              </b>
              <Copiar texto={panel} etiqueta="Copiar dirección" className="tab" />
            </div>
          </div>
        </div>
      </section>
    </Marco>
  );
}
