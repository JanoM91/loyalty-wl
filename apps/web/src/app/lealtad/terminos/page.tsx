import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { VERSION_TERMINOS, prisma, programaVigente } from '@wl/database';

import { exigirNegocio, sitioDeLaPeticion } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Términos del programa' };
export const dynamic = 'force-dynamic';

/**
 * Términos y condiciones del programa de lealtad.
 *
 * **Es una plantilla general, no asesoría legal.** Parte del texto que
 * Exkalibur redactó para LAPANA y se llena con los datos de cada negocio
 * (razón social, domicilio, correo, sucursales, premios y reglas). Cada
 * negocio debe revisarla con su abogado antes de abrir su programa al público.
 *
 * Las cifras salen del programa vigente en la base, así que si la regla
 * cambia, el texto cambia con ella. Al cambiar el texto, cambiar también
 * `VERSION_TERMINOS` en @wl/database: cada tarjeta guarda la versión que aceptó.
 */
export default async function TerminosPage() {
  const [negocio, programa, sitio, sucursales] = await Promise.all([
    exigirNegocio(),
    programaVigente(),
    sitioDeLaPeticion(),
    prisma.branch.findMany({
      where: { isActive: true, loyaltyEnabled: true },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
  ]);
  const hitos = [...programa.hitos].sort((a, b) => a.posicion - b.posicion);
  const nombre = negocio.nombre;
  const legal = negocio.marca.legal;
  const organiza = legal.razonSocial ?? nombre;
  const correo = legal.correoPrivacidad ?? negocio.marca.contacto.correo;
  const horasContingencia = programa.ventanaContingenciaDias * 24;
  const comprobanteObligatorio = negocio.ajustes.comprobanteConQr === 'OBLIGATORIO';
  return (
    <article className="grid gap-5 text-sm leading-relaxed text-ink-soft">
      <header className="grid gap-1">
        <a href="/lealtad" className="text-sm text-crust-dark underline underline-offset-4">
          ← Programa de lealtad
        </a>
        <h1 className="text-2xl text-ink">Términos y condiciones del programa de lealtad</h1>
        <p className="text-xs text-muted">Versión {VERSION_TERMINOS}</p>
      </header>

      <Seccion n={1} titulo="Quién organiza el programa">
        <p>
          El programa de lealtad (el «Programa») lo organiza {organiza}
          {organiza === nombre ? '' : ` («${nombre}»)`}
          {legal.domicilio ? `, con domicilio en ${legal.domicilio}` : ''}. Participar es gratuito y
          voluntario, y no requiere comprar nada adicional.
        </p>
      </Seccion>

      <Seccion n={2} titulo="Quién puede participar">
        <p>
          Personas físicas mayores de edad que se registren en {sitio}/lealtad con un número de
          celular o un correo electrónico. Cada persona puede tener una sola tarjeta. La tarjeta es
          personal, no tiene valor monetario y no se puede vender ni cambiar por dinero.
        </p>
      </Seccion>

      <Seccion n={3} titulo="Cómo se ganan estampas">
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>
            Se gana <b className="font-semibold text-ink">una estampa por cada compra presencial</b>{' '}
            en una sucursal participante, sin importar el importe, al mostrar el código de la
            tarjeta en caja
            {comprobanteObligatorio
              ? ' y entregar el ticket de esa compra.'
              : '. En caja se pide el ticket de esa compra para registrar su folio.'}
          </li>
          <li>Se acredita como máximo una compra por tarjeta, por sucursal y por día.</li>
          <li>Cada ticket se acredita una sola vez y a una sola tarjeta.</li>
          <li>
            Un ticket de hasta {horasContingencia} horas antes puede registrarse como contingencia
            (por ejemplo, si no hubo internet en caja). Queda pendiente hasta que {nombre} lo
            valide. Los tickets más antiguos se revisan caso por caso.
          </li>
          <li>Solo las compras presenciales acumulan estampas.</li>
          <li>Si una compra se cancela o se devuelve, la estampa que generó se retira.</li>
        </ul>
      </Seccion>

      <Seccion n={4} titulo="Premios">
        <ul className="grid list-disc gap-1.5 pl-5">
          {hitos.map((h) => (
            <li key={h.posicion}>
              Al reunir <b className="font-semibold text-ink">{h.posicion} estampas</b>:{' '}
              {h.nombre.toLowerCase()}
              {h.incluye ? ` (${h.incluye.replace(/\.$/, '').toLowerCase()})` : ''}.
            </li>
          ))}
          <li>Al completar las {programa.posiciones} estampas empieza una tarjeta nueva.</li>
          <li>
            Los premios se canjean en cualquier sucursal participante mostrando el código de la
            tarjeta, y están sujetos a la disponibilidad de producto del día. Si el producto elegido
            no está disponible, se ofrece otro equivalente.
          </li>
          <li>
            Para canjear un premio la tarjeta debe tener un correo o un celular verificado. Cada
            premio se entrega una sola vez.
          </li>
          <li>
            Los premios no se cambian por dinero ni por otros productos distintos de los indicados.
          </li>
        </ul>
      </Seccion>

      <Seccion n={5} titulo="Vigencia de estampas y premios">
        <p>
          Mientras el Programa esté vigente, las estampas y los premios no vencen. Si {nombre}{' '}
          decide establecer una vigencia, lo avisará con al menos 30 días naturales de anticipación
          y aplicará solo a estampas y premios generados después del aviso.
        </p>
      </Seccion>

      <Seccion n={6} titulo="Sucursales participantes">
        <p>
          {sucursales.length > 0
            ? `${sucursales.map((b) => b.name).join(', ')}, a partir de la fecha en que cada una se incorpore al Programa. `
            : 'Las sucursales participantes se anunciarán al arrancar el Programa. '}
          La lista vigente se publica en {sitio}/lealtad.
        </p>
      </Seccion>

      <Seccion n={7} titulo="Uso indebido">
        <p>
          {nombre} puede suspender o cancelar una tarjeta, y retirar estampas o premios, cuando se
          acrediten tickets que no corresponden a compras de quien la usa, se intente acreditar un
          ticket más de una vez o se manipule el Programa de cualquier otra forma. Antes de cancelar
          una tarjeta, {nombre} lo informará a su titular al contacto registrado.
        </p>
      </Seccion>

      <Seccion n={8} titulo="Aclaraciones">
        <p>
          Si una compra no aparece en tu historial o crees que hay un error, avísanos dentro de los
          30 días siguientes a la compra{correo ? ` en ${correo}` : ' en cualquier sucursal'}, con
          el folio del ticket. Lo revisaremos con el registro de caja.
        </p>
      </Seccion>

      <Seccion n={9} titulo="Comunicaciones">
        <p>
          Te enviaremos avisos sobre tu tarjeta, como premios disponibles y códigos de verificación.
          Solo te enviaremos promociones si lo aceptaste expresamente, y puedes darte de baja en
          cualquier momento desde el perfil de tu tarjeta o en el enlace de cada mensaje.
        </p>
      </Seccion>

      <Seccion n={10} titulo="Datos personales">
        <p>
          El tratamiento de tus datos se describe en el{' '}
          <a href="/lealtad/privacidad" className="text-crust-dark underline underline-offset-2">
            aviso de privacidad
          </a>
          .
        </p>
      </Seccion>

      <Seccion n={11} titulo="Cambios y terminación del Programa">
        <p>
          {nombre} puede modificar estos términos o terminar el Programa avisando con al menos 30
          días naturales de anticipación en {sitio}/lealtad y en las sucursales. Si el Programa
          termina, los premios ya generados podrán canjearse durante los 60 días naturales
          siguientes a la fecha de terminación.
        </p>
      </Seccion>

      <Seccion n={12} titulo="Legislación aplicable">
        <p>
          Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier
          controversia, la Procuraduría Federal del Consumidor es competente en la vía
          administrativa y, en su caso, los tribunales del domicilio del organizador.
        </p>
      </Seccion>
    </article>
  );
}

function Seccion({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg text-ink">
        {n}. {titulo}
      </h2>
      {children}
    </section>
  );
}
