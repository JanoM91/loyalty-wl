import { MINUTOS_ENLACE_RECUPERACION } from '@wl/database';

import { Marco } from '@/components/sitio/Marco';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

import { FormularioRecuperar } from '../Formularios';

export const dynamic = 'force-dynamic';

export const metadata = {
  ...metadatosDelSitio('Olvidé mi contraseña', 'Elige una contraseña nueva para tu panel.'),
  robots: { index: false, follow: false },
};

/** «Olvidé mi contraseña» desde club-lealtad.com, con ayuda por WhatsApp. */
export default async function Recuperar() {
  await exigirSitioDelServicio();
  return (
    <Marco actual="/entrar" compacto>
      <section className="sec" style={{ paddingTop: 40 }}>
        <div className="wrap col" style={{ maxWidth: 520, gap: 22 }}>
          <h1 className="d h2">Olvidé mi contraseña</h1>
          <p className="lead" style={{ fontSize: 18 }}>
            Te mandamos un enlace a tu correo para elegir una nueva.
          </p>
          <FormularioRecuperar
            minutos={MINUTOS_ENLACE_RECUPERACION}
            whatsapp={enlaceWhatsAppServicio(
              'Hola, olvidé la contraseña del panel de mi club en club-lealtad. Mi club se llama: ',
            )}
          />
          <p className="p" style={{ fontSize: 15 }}>
            <a href="/entrar" className="ul">
              Volver a entrar
            </a>
          </p>
        </div>
      </section>
    </Marco>
  );
}
