import Link from 'next/link';
import { pesos } from '@wl/domain';

import { Apartado, Correo, Documento, TITULAR } from '@/components/sitio/Legal';
import { Marco, enlaceWhatsApp } from '@/components/sitio/Marco';
import { precios } from '@/lib/precios';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Términos del servicio',
  'Las reglas de club-lealtad Lite: prueba gratis, precio, pago, datos y responsabilidades.',
);

/**
 * Términos del servicio club-lealtad Lite, para los negocios. Los términos
 * del programa de cada club (los que aceptan sus clientes) viven en
 * `/<negocio>/lealtad/terminos`.
 *
 * Plantilla para revisión de abogado: ver `components/sitio/Legal.tsx`.
 */
export default async function Terminos() {
  await exigirSitioDelServicio();
  const { lite } = await precios();
  return (
    <Marco>
      <Documento
        titulo="Términos del servicio"
        entrada={
          <>
            Las reglas para usar club-lealtad Lite. Al crear tu club las aceptas. Si algo no está
            claro, escríbenos antes de empezar.
          </>
        }
      >
        <Apartado titulo="1. Quién presta el servicio">
          <p>
            {TITULAR.nombre}, persona física con actividad empresarial, que opera con el nombre
            comercial «{TITULAR.nombreComercial}» (en estos términos, «club-lealtad» o «nosotros»),
            con domicilio en {TITULAR.domicilio}. Contacto:{' '}
            <a href={enlaceWhatsApp()} className="ul">
              WhatsApp
            </a>{' '}
            y <Correo />.
          </p>
        </Apartado>

        <Apartado titulo="2. Qué es el servicio">
          <p>
            club-lealtad Lite te permite operar el programa de cliente frecuente de tu negocio en{' '}
            {TITULAR.sitio}/tu-negocio: la tarjeta digital de tus clientes, la caja con código QR
            para sellar visitas, los premios y tu panel. Tú eliges nombre, colores, premio y número
            de sellos.
          </p>
          <p>
            Las funciones que dependen de terceros, como Apple Wallet y Google Wallet, están sujetas
            a sus reglas y pueden cambiar o no estar disponibles. El plan Privada y los servicios
            adicionales se contratan por separado.
          </p>
        </Apartado>

        <Apartado titulo="3. Tu cuenta">
          <ul>
            <li>
              Debes ser mayor de edad y tener facultades para contratar en nombre del negocio.
            </li>
            <li>Los datos que nos das deben ser verdaderos y estar al día.</li>
            <li>
              Eres responsable de tu contraseña y de las personas a las que das acceso a tu panel o
              a tu caja.
            </li>
          </ul>
        </Apartado>

        <Apartado titulo="4. Prueba gratis">
          <ul>
            <li>
              Dura 7 días naturales desde que creas tu club, incluye todo Lite y el servicio
              adicional «Juega y gana», y no pide tarjeta bancaria.
            </li>
            <li>
              Durante la prueba: una sucursal y hasta 200 tarjetas. Un club por correo y por
              WhatsApp.
            </li>
            <li>
              Si al terminar no has pagado, tu club se pausa: la caja deja de sellar y no se crean
              tarjetas nuevas. Lo reactivas al pagar.
            </li>
            <li>
              «Juega y gana» termina con la prueba aunque pagues Lite; para seguir con él se
              contrata aparte. Las promociones que tus clientes ya ganaron se pueden cobrar en tu
              caja hasta que venzan.
            </li>
            <li>
              Si pasan 30 días naturales con el club pausado, lo borramos de forma definitiva, con
              sus tarjetas y las cuentas de tu equipo.
            </li>
          </ul>
        </Apartado>

        <Apartado titulo="5. Precio y pago">
          <ul>
            <li>
              Lite cuesta{' '}
              <b>
                {lite.mes !== null ? `${pesos(lite.mes)} MXN al mes` : 'lo publicado en este sitio'}
              </b>
              {lite.anio !== null ? (
                <>
                  {' '}
                  o <b>{pesos(lite.anio)} MXN al año</b>
                </>
              ) : null}
              , IVA incluido. Se paga por adelantado con el enlace de pago que te enviamos.
            </li>
            <li>Activamos tu club al confirmar el pago. No hay cargos automáticos.</li>
            <li>
              Si al terminar un periodo pagado no renuevas, tu club se pausa y se aplica lo del
              punto 4.
            </li>
            <li>Emitimos factura (CFDI) a quien la pida con sus datos fiscales.</li>
            <li>
              Podemos cambiar los precios avisándote con al menos 30 días naturales. El cambio no
              afecta un periodo ya pagado.
            </li>
            <li>
              Los pagos no se reembolsan por periodos usados en parte, salvo lo previsto en el punto
              10.
            </li>
          </ul>
        </Apartado>

        <Apartado titulo="6. Tu programa y tus clientes">
          <ul>
            <li>
              El programa de lealtad es de tu negocio. Tú defines y entregas los premios, y
              respondes ante tus clientes por ellos.
            </li>
            <li>
              Cada club publica, con los datos de tu negocio, unos términos del programa y un aviso
              de privacidad para tus clientes. Son plantillas: revísalas con tu abogado y mantén tus
              datos de contacto al día en tu panel.
            </li>
            <li>
              Si tu club se pausa o lo cancelas, te toca avisar a tus clientes y entregar los
              premios que ya ganaron, conforme a los términos de tu programa.
            </li>
            <li>
              Solo das de alta a clientes que lo aceptan y no usas el servicio para enviar mensajes
              que no pidieron.
            </li>
          </ul>
        </Apartado>

        <Apartado titulo="7. Datos de tus clientes">
          <p>
            Tu negocio es el responsable de los datos de sus clientes y club-lealtad los trata por
            tu cuenta. Nos comprometemos a usarlos solo para operar tu programa, a no venderlos ni
            usarlos para fines propios, a guardar confidencialidad, a protegerlos con medidas de
            seguridad razonables y a borrarlos cuando se borre tu club. Antes de que eso pase,
            puedes pedirnos por correo una copia de las tarjetas de tus clientes.
          </p>
          <p>
            El tratamiento de tus propios datos se describe en el{' '}
            <Link href="/privacidad" className="ul">
              aviso de privacidad
            </Link>
            .
          </p>
        </Apartado>

        <Apartado titulo="8. Uso permitido">
          <p>
            No puedes usar club-lealtad para actividades ilegales, para engañar a tus clientes, para
            intentar entrar a datos de otros negocios ni para alterar el funcionamiento de la
            plataforma. Si ocurre, podemos suspender tu club de inmediato y avisarte por correo o
            WhatsApp.
          </p>
        </Apartado>

        <Apartado titulo="9. Marcas y contenido">
          <p>
            La plataforma y la marca club-lealtad son nuestras. Tu nombre, logotipo e imágenes
            siguen siendo tuyos; nos das permiso de mostrarlos en tu club mientras uses el servicio.
            Debes tener derecho a usar lo que subas.
          </p>
        </Apartado>

        <Apartado titulo="10. Disponibilidad y responsabilidad">
          <ul>
            <li>
              Hacemos lo razonable para que el servicio funcione siempre, pero puede haber
              interrupciones por mantenimiento, fallas de internet o de nuestros proveedores.
            </li>
            <li>
              Si una falla atribuible a nosotros te impide sellar visitas por más de 3 días
              naturales seguidos, te compensamos con los días afectados o, si lo prefieres, te
              devolvemos la parte proporcional del periodo pagado.
            </li>
            <li>
              Nuestra responsabilidad total se limita a lo que pagaste en los 12 meses anteriores al
              hecho. No respondemos por ventas o utilidades que dejaste de obtener. Esto no aplica
              en caso de dolo o mala fe.
            </li>
          </ul>
        </Apartado>

        <Apartado titulo="11. Cancelación">
          <p>
            Puedes dejar de usar el servicio cuando quieras: basta con no renovar, o pedirnos que
            borremos tu club antes. Nosotros podemos dejar de ofrecer Lite avisándote con al menos
            30 días naturales; en ese caso te devolvemos la parte del periodo pagado que no alcances
            a usar.
          </p>
        </Apartado>

        <Apartado titulo="12. Cambios a estos términos">
          <p>
            Publicaremos cualquier cambio en esta página con su fecha y te avisaremos por correo o
            WhatsApp al menos 15 días naturales antes de aplicarlo. Si no estás de acuerdo, puedes
            cancelar antes de esa fecha.
          </p>
        </Apartado>

        <Apartado titulo="13. Leyes y tribunales">
          <p>
            Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier
            controversia, las partes se someten a los tribunales de Xalapa, Veracruz, y renuncian a
            cualquier otro fuero que pudiera corresponderles.
          </p>
        </Apartado>
      </Documento>
    </Marco>
  );
}
