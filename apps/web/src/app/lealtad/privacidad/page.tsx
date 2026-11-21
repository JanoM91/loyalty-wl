import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { arcadeVigente } from '@wl/domain';

import { exigirNegocio } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Aviso de privacidad' };
export const dynamic = 'force-dynamic';

/**
 * Aviso de privacidad del programa de lealtad.
 *
 * **Es una plantilla general, no asesoría legal.** Describe lo que la
 * plataforma hace de verdad con los datos (qué guarda, para qué y cuánto
 * tiempo) y se llena con los datos de cada negocio, que es el responsable del
 * tratamiento. Cada negocio debe revisarla con su abogado antes de abrir su
 * programa al público.
 */
export default async function PrivacidadPage() {
  const negocio = await exigirNegocio();
  const legal = negocio.marca.legal;
  const responsable = legal.razonSocial ?? negocio.nombre;
  const correo = legal.correoPrivacidad ?? negocio.marca.contacto.correo;
  const dias = negocio.ajustes.diasConservacionFotos;
  const pideTicket = negocio.ajustes.comprobanteConQr !== 'NO_PEDIR';
  const conJuegos = arcadeVigente(negocio.ajustes.arcade);

  return (
    <article className="grid gap-5 text-sm leading-relaxed text-ink-soft">
      <header className="grid gap-1">
        <a href="/lealtad" className="text-sm text-crust-dark underline underline-offset-4">
          ← Programa de lealtad
        </a>
        <h1 className="text-2xl text-ink">Aviso de privacidad del programa de lealtad</h1>
      </header>

      <Seccion titulo="Quién es responsable de tus datos">
        <p>
          {responsable}
          {legal.domicilio ? `, con domicilio en ${legal.domicilio},` : ''} es responsable de los
          datos personales que nos das al participar en el programa de lealtad de {negocio.nombre}.
        </p>
      </Seccion>

      <Seccion titulo="Qué datos guardamos">
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>Tu celular o tu correo electrónico, para identificar tu tarjeta.</li>
          <li>Tu nombre y el día y mes de tu cumpleaños, si decides darlos.</li>
          <li>
            {pideTicket
              ? 'Tus visitas: fecha, sucursal y folio del ticket; en algunos casos, una foto del ticket.'
              : 'Tus visitas: fecha y sucursal.'}
          </li>
          <li>Los premios que ganas y canjeas.</li>
          {conJuegos && (
            <li>
              Si juegas en «Juega y gana»: tus partidas (juego, día, duración, puntos y nivel) y las
              promociones que ganas y cobras.
            </li>
          )}
        </ul>
        <p>No pedimos ni guardamos datos de pago ni datos sensibles.</p>
      </Seccion>

      <Seccion titulo="Para qué los usamos">
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>Llevar la cuenta de tus sellos y entregarte tus premios.</li>
          {conJuegos && (
            <li>
              Medir tus retos, entregarte las promociones que ganes y, si el club la tiene, mostrar
              la lista de la semana con tu nombre abreviado (por ejemplo, «Ana L.»).
            </li>
          )}
          <li>Enviarte avisos de tu tarjeta, como códigos de verificación y enlaces de acceso.</li>
          <li>Prevenir el uso indebido del programa.</li>
          <li>
            Enviarte promociones, <b className="font-semibold text-ink">solo si lo aceptaste</b>.
            Puedes cambiarlo cuando quieras desde el perfil de tu tarjeta.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Con quién se comparten">
        <p>
          No vendemos tus datos. Los tratan, por cuenta de {negocio.nombre}, los proveedores que
          operan la plataforma del programa (tecnología, alojamiento y envío de correos), que solo
          pueden usarlos para prestar ese servicio.
        </p>
      </Seccion>

      <Seccion titulo="Cuánto tiempo los conservamos">
        <p>
          {pideTicket ? `Las fotos de tickets se borran a los ${dias} días de la compra. ` : ''}Tus
          datos se conservan mientras tu tarjeta esté activa y el programa siga vigente. Si el
          programa termina, se borran.
        </p>
      </Seccion>

      <Seccion titulo="Tus derechos">
        <p>
          Puedes pedir acceso a tus datos, corregirlos, cancelarlos u oponerte a su uso (derechos
          ARCO)
          {correo ? ` escribiendo a ${correo}` : ' en cualquiera de nuestras sucursales'}. Te
          responderemos en los plazos que marca la ley.
        </p>
      </Seccion>

      <Seccion titulo="Cambios a este aviso">
        <p>Si este aviso cambia, publicaremos la versión nueva en esta misma página.</p>
      </Seccion>
    </article>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg text-ink">{titulo}</h2>
      {children}
    </section>
  );
}
