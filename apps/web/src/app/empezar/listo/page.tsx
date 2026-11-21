import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { negocioPorSlug } from '@wl/database';
import { diasRestantesDePrueba } from '@wl/domain';

import { Marco } from '@/components/sitio/Marco';
import { qrSvg } from '@/lib/lealtad/qr';
import { origenDeLaPeticion } from '@/lib/negocio';
import { exigirSitioDelServicio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Tu club está listo | Club Lealtad' },
  robots: { index: false, follow: false },
  // El enlace de contraseña va en la dirección: que no viaje como página de origen.
  referrer: 'no-referrer',
};

/**
 * Pantalla final del asistente: el club ya existe. Desde aquí el dueño elige
 * su contraseña, saca su propia tarjeta y se lleva el QR de su mostrador.
 */
export default async function Listo({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; t?: string }>;
}) {
  await exigirSitioDelServicio();
  const { n, t } = await searchParams;
  const negocio = n ? await negocioPorSlug(n) : null;
  // Solo clubes creados desde el asistente: no se asoma a ningún otro negocio.
  if (!negocio || !negocio.ajustes.alta) notFound();

  const base = `/${negocio.slug}`;
  const afiliacion = `${await origenDeLaPeticion()}${base}/lealtad/unete/principal`;
  const qr = await qrSvg(afiliacion, '#06231c');
  const dias = diasRestantesDePrueba(negocio.ajustes.pruebaVence);
  const wallet = Boolean(process.env.APPLE_PASS_TYPE_ID || process.env.GOOGLE_WALLET_ISSUER_ID);
  const token = t && /^[A-Za-z0-9_-]{16,200}$/.test(t) ? t : null;

  return (
    <Marco>
      <section className="sec" style={{ paddingTop: 64 }}>
        <div className="wrap col" style={{ maxWidth: 860, gap: 28 }}>
          <span className="chip">
            {dias > 0 ? `Prueba gratis: te quedan ${dias} días` : 'Tu club'}
          </span>
          <h1 className="d h1">{negocio.nombre} ya tiene su club.</h1>
          <p className="lead">Tres pasos y lo estás usando. Guarda esta página.</p>

          <ol className="col" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            <li className="ps">
              <span className="num" aria-hidden="true">
                1
              </span>
              <div className="col" style={{ gap: 10, minWidth: 0 }}>
                <h2 className="d h3">Elige tu contraseña</h2>
                <p className="p">Con ella entras a tu panel y a tu caja.</p>
                {token ? (
                  <a
                    href={`${base}/admin/contrasena/${token}`}
                    className="btn"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Elegir contraseña
                  </a>
                ) : (
                  <a href={`${base}/admin/entrar`} className="lk">
                    Entrar a mi panel
                  </a>
                )}
              </div>
            </li>
            <li className="ps">
              <span className="num" aria-hidden="true">
                2
              </span>
              <div className="col" style={{ gap: 10, minWidth: 0 }}>
                <h2 className="d h3">Saca tu propia tarjeta</h2>
                <p className="p">
                  {wallet
                    ? 'Como lo hará tu cliente. Al crearla, guárdala en tu Wallet con un toque.'
                    : 'Como lo hará tu cliente: con su celular, sin descargar nada.'}
                </p>
                <a
                  href={`${base}/lealtad/unete/principal`}
                  className="btn inv"
                  style={{ alignSelf: 'flex-start' }}
                >
                  Sacar mi tarjeta
                </a>
              </div>
            </li>
            <li className="ps">
              <span className="num" aria-hidden="true">
                3
              </span>
              <div className="col" style={{ gap: 12, minWidth: 0 }}>
                <h2 className="d h3">Pon este QR donde cobras</h2>
                <p className="p">Tus clientes lo escanean y sacan su tarjeta.</p>
                <div
                  className="qr"
                  role="img"
                  aria-label={`Código QR para unirse al club de ${negocio.nombre}`}
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <span className="sm2" style={{ wordBreak: 'break-all' }}>
                  {afiliacion}
                </span>
                <p className="p">
                  El cartel para imprimir está en tu panel, en «Sucursales y códigos».
                </p>
              </div>
            </li>
          </ol>

          <div className="panel col" style={{ gap: 8 }}>
            <b>Para sellar una visita</b>
            <span className="p">
              Entra a tu panel, abre «Caja» y escanea el QR de la tarjeta de tu cliente.
            </span>
            <a href={`${base}/admin`} className="lk" style={{ alignSelf: 'flex-start' }}>
              {`club-lealtad.com${base}/admin`}
            </a>
          </div>
        </div>
      </section>
    </Marco>
  );
}
