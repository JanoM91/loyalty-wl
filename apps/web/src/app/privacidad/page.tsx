import Link from 'next/link';

import { Apartado, Correo, Documento, TITULAR } from '@/components/sitio/Legal';
import { Marco } from '@/components/sitio/Marco';
import { MEDICION_ACTIVA } from '@/lib/medicion';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Aviso de privacidad',
  'Cómo trata club-lealtad los datos de los negocios que usan el servicio y de sus clientes.',
);

/**
 * Aviso de privacidad del servicio club-lealtad (dueños y negocios). El aviso
 * de los clientes de cada club vive en `/<negocio>/lealtad/privacidad`; ahí
 * el responsable es el negocio y club-lealtad actúa como encargado.
 *
 * Plantilla para revisión de abogado: ver `components/sitio/Legal.tsx`.
 */
export default async function Privacidad() {
  await exigirSitioDelServicio();
  return (
    <Marco>
      <Documento
        titulo="Aviso de privacidad"
        entrada={
          <>
            Este aviso es para quien crea y administra un club en {TITULAR.sitio}. Si tienes la
            tarjeta de un negocio, su aviso está en la página de su programa.
          </>
        }
      >
        <div className="caja col legal" style={{ gap: 10 }}>
          <b>Aviso simplificado</b>
          <p>
            {TITULAR.nombre}, que opera con el nombre comercial «{TITULAR.nombreComercial}», con
            domicilio en {TITULAR.domicilio}, usa el nombre y giro de tu negocio, tu WhatsApp y tu
            correo para crear y operar tu club, darte acceso a tu panel, comunicarse contigo sobre
            el servicio y cobrarlo. Con tu permiso, también para enviarte novedades del servicio;
            puedes negarte escribiendo a <Correo />. El resto de este aviso es la versión integral.
          </p>
        </div>

        <Apartado titulo="1. Quién es responsable de tus datos">
          <p>
            {TITULAR.nombre}, persona física con actividad empresarial, que opera con el nombre
            comercial «{TITULAR.nombreComercial}», con domicilio en {TITULAR.domicilio}. Para
            cualquier tema de privacidad: <Correo />.
          </p>
        </Apartado>

        <Apartado titulo="2. Qué datos tratamos">
          <ul>
            <li>
              <b>Del negocio:</b> nombre, giro, colores, premio y reglas de su tarjeta, sucursales
              y, si los subes, logotipo e imágenes.
            </li>
            <li>
              <b>De quien da de alta el club y de su equipo:</b> nombre, WhatsApp, correo y
              contraseña. La contraseña se guarda cifrada; nadie puede leerla.
            </li>
            <li>
              <b>Para cobrar y facturar:</b> fecha, importe y referencia de cada pago y, si pides
              factura, tus datos fiscales (RFC, nombre o razón social, régimen fiscal y código
              postal). No recibimos ni guardamos números de tarjeta bancaria: el pago lo procesa el
              proveedor de cobro.
            </li>
            <li>
              <b>De uso:</b> la página por la que llegaste, los registros de acceso a tu panel
              (fecha, dirección IP y navegador), las operaciones de caja y una huella cifrada de la
              conexión desde la que creas tu club, que no permite saber tu dirección IP y solo sirve
              para frenar altas abusivas.
            </li>
          </ul>
          <p>
            No tratamos datos personales sensibles. La foto de tu logotipo que eliges en el
            asistente no se sube: solo se lee su color en tu teléfono.
          </p>
        </Apartado>

        <Apartado titulo="3. Para qué los usamos">
          <p>
            <b>Finalidades necesarias para el servicio:</b>
          </p>
          <ul>
            <li>Crear tu club, operarlo y darte acceso a tu panel y a tu caja.</li>
            <li>
              Verificar que cada club tenga un solo correo y un solo WhatsApp, y prevenir abusos.
            </li>
            <li>
              Avisarte por WhatsApp o correo sobre tu prueba, tus pagos, cambios en el servicio y
              soporte.
            </li>
            <li>Cobrar el servicio y emitir facturas.</li>
            <li>Cumplir obligaciones legales y fiscales, y atender requerimientos de autoridad.</li>
          </ul>
          <p>
            <b>Finalidades que no son necesarias</b> y que puedes rechazar sin afectar tu club:
          </p>
          <ul>
            <li>Enviarte novedades, promociones y encuestas de club-lealtad.</li>
            <li>
              Mencionar el nombre de tu negocio como cliente de club-lealtad, por ejemplo en la
              sección de negocios del sitio, solo si nos das permiso por escrito.
            </li>
            {MEDICION_ACTIVA && (
              <li>
                Medir, con el pixel de Meta, qué anuncios te trajeron al sitio y si creaste tu club,
                para decidir dónde anunciarnos.
              </li>
            )}
          </ul>
          <p>
            Para rechazarlas, escribe a <Correo /> con el asunto «No a finalidades adicionales». Lo
            aplicamos en un máximo de 5 días hábiles.
          </p>
        </Apartado>

        <Apartado id="clientes" titulo="4. Los datos de los clientes de tu club">
          <p>
            Cuando tus clientes sacan su tarjeta, el responsable de sus datos es tu negocio.
            club-lealtad los trata solo por tu cuenta y para operar tu programa: no los vende, no
            los usa para fines propios y no les envía publicidad de club-lealtad.
          </p>
          <p>
            Cada club publica el aviso de privacidad de sus clientes en su propia página. Es una
            plantilla con los datos de tu negocio; revísala y ajústala con tu abogado.
          </p>
        </Apartado>

        <Apartado titulo="5. Con quién se comparten">
          <p>
            No vendemos datos. Los tratan, por nuestra cuenta y solo para prestar el servicio,
            proveedores de alojamiento y base de datos (Vercel y Neon, con servidores en Estados
            Unidos), de envío de correo y, cuando pagas, de cobro. Además, compartimos tus datos
            fiscales con el Servicio de Administración Tributaria al facturar, y con autoridades
            cuando una ley o una orden lo exija.
          </p>
          {MEDICION_ACTIVA && (
            <p>
              En las páginas del sitio (nunca en las tarjetas ni en los paneles de los clubes), Meta
              Platforms recibe por medio de su pixel datos de navegación, como tu dirección IP, tu
              navegador y las páginas que visitas, para medir nuestros anuncios. Meta los trata
              también conforme a su propia política de privacidad.
            </p>
          )}
        </Apartado>

        <Apartado titulo="6. Cuánto tiempo los conservamos">
          <ul>
            <li>Mientras tu club esté en prueba o pagado.</li>
            <li>
              Si tu club se pausa por falta de pago, 30 días naturales. Después se borran el club,
              sus tarjetas y las cuentas de su equipo.
            </li>
            <li>
              Los pagos y facturas se conservan el tiempo que exigen las leyes fiscales, aunque el
              club se borre.
            </li>
          </ul>
        </Apartado>

        <Apartado titulo="7. Tus derechos y cómo ejercerlos">
          <p>
            Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso (derechos
            ARCO), y revocar tu consentimiento. Escribe a <Correo /> con:
          </p>
          <ul>
            <li>Tu nombre y un medio para responderte.</li>
            <li>Una identificación oficial o, si actúas por alguien más, tu representación.</li>
            <li>Qué derecho ejerces y sobre qué datos, y cualquier dato que ayude a ubicarlos.</li>
          </ul>
          <p>
            Respondemos en un máximo de 20 días y, si procede, lo aplicamos dentro de los 15 días
            siguientes. Es gratuito. La revocación no tiene efectos hacia atrás y puede impedir que
            sigamos prestando el servicio, por ejemplo si pides borrar el correo con el que entras.
          </p>
          <p>Para dejar de recibir novedades basta con responder «BAJA» al mensaje o al correo.</p>
        </Apartado>

        <Apartado titulo="8. Cookies">
          {MEDICION_ACTIVA ? (
            <p>
              Usamos las cookies necesarias para mantener abierta tu sesión y recordar el club en el
              que trabajas. Además, en las páginas del sitio usamos el pixel de Meta, que guarda
              cookies para medir nuestros anuncios. Puedes rechazarlas bloqueando las cookies de
              terceros en tu navegador o desde la configuración de anuncios de tu cuenta de Meta.
              Nunca se usa en las tarjetas ni en los paneles de los clubes.
            </p>
          ) : (
            <p>
              Usamos solo las cookies necesarias para mantener abierta tu sesión y recordar el club
              en el que trabajas. No usamos cookies de publicidad ni de medición de terceros.
            </p>
          )}
        </Apartado>

        <Apartado titulo="9. Cambios a este aviso">
          <p>
            Publicaremos cualquier cambio en{' '}
            <Link href="/privacidad" className="ul">
              {TITULAR.sitio}/privacidad
            </Link>{' '}
            con su fecha. Si el cambio afecta cómo usamos tus datos, te avisaremos por correo o
            WhatsApp antes de aplicarlo.
          </p>
        </Apartado>

        <Apartado titulo="10. Autoridad">
          <p>
            Si consideras que no atendimos tu solicitud, puedes acudir a la Secretaría
            Anticorrupción y Buen Gobierno, autoridad en protección de datos personales en posesión
            de particulares.
          </p>
        </Apartado>

        <p className="p">
          Consulta también los{' '}
          <Link href="/terminos" className="ul">
            términos del servicio
          </Link>
          .
        </p>
      </Documento>
    </Marco>
  );
}
