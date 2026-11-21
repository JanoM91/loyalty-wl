import { Marco } from '@/components/sitio/Marco';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

import { FormularioEntrar } from './Formularios';

export const dynamic = 'force-dynamic';

export const metadata = {
  ...metadatosDelSitio(
    'Entrar a mi panel',
    'Entra al panel de tu club con tu correo y tu contraseña.',
  ),
  robots: { index: false, follow: true },
};

/**
 * Entrada general al panel desde club-lealtad.com: el dueño no tiene que
 * recordar la dirección de su club, solo su correo y su contraseña.
 */
export default async function Entrar() {
  await exigirSitioDelServicio();
  return (
    <Marco actual="/entrar" compacto>
      <section className="sec" style={{ paddingTop: 40 }}>
        <div className="wrap col" style={{ maxWidth: 520, gap: 22 }}>
          <h1 className="d h2">Entra a tu panel</h1>
          <p className="lead" style={{ fontSize: 18 }}>
            Con el correo y la contraseña que elegiste al crear tu club.
          </p>
          <FormularioEntrar />
          <p className="p" style={{ fontSize: 15 }}>
            ¿Aún no tienes club?{' '}
            <a href="/empezar" className="ul">
              Créalo gratis
            </a>
          </p>
        </div>
      </section>
    </Marco>
  );
}
