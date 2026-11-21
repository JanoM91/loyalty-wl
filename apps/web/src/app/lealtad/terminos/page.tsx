import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { VERSION_TERMINOS, prisma, programaVigente } from '@wl/database';

import { exigirNegocio, sitioDeLaPeticion } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Términos del programa' };
export const dynamic = 'force-dynamic';

/**
 * Términos del programa de lealtad de un club, para sus clientes.
 *
 * **Plantilla general, no asesoría legal.** Es genérica a propósito: sirve
 * para cualquier giro (barbería, cafetería, salón…) y no promete plazos que un
 * club en prueba no pueda cumplir. Se llena con los datos del negocio y de su
 * programa vigente: si cambian los premios, el texto cambia con ellos. Cada
 * negocio debe revisarla con su abogado.
 *
 * Al cambiar el texto, cambiar también `VERSION_TERMINOS` en @wl/database:
 * cada tarjeta guarda la versión que aceptó.
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
  const { legal, contacto } = negocio.marca;
  const organiza = legal.razonSocial ?? nombre;
  const correo = legal.correoPrivacidad ?? contacto.correo;
  const whatsapp = contacto.whatsapp;
  const varias = sucursales.length > 1;
  const pideTicket = negocio.ajustes.comprobanteConQr !== 'NO_PEDIR';

  return (
    <article className="grid gap-5 text-sm leading-relaxed text-ink-soft">
      <header className="grid gap-1">
        <a href="/lealtad" className="text-sm text-crust-dark underline underline-offset-4">
          ← Programa de lealtad
        </a>
        <h1 className="text-2xl text-ink">Términos del programa de lealtad</h1>
        <p className="text-xs text-muted">Versión {VERSION_TERMINOS}</p>
      </header>

      <Seccion n={1} titulo="Quién ofrece el programa">
        <p>
          {organiza}
          {organiza === nombre ? '' : ` («${nombre}»)`}
          {legal.domicilio ? `, con domicilio en ${legal.domicilio},` : ''} ofrece este programa y
          entrega sus premios. Participar es gratis y voluntario.
        </p>
      </Seccion>

      <Seccion n={2} titulo="Tu tarjeta">
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>
            La creas en {sitio}/lealtad con tu celular o tu correo. No necesitas instalar nada.
          </li>
          <li>Es personal: una tarjeta por persona. No tiene valor en dinero.</li>
        </ul>
      </Seccion>

      <Seccion n={3} titulo="Cómo sumas estampas">
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>
            Muestra el código de tu tarjeta al pagar y sumas{' '}
            <b className="font-semibold text-ink">una estampa por visita</b>
            {varias ? ', máximo una al día en cada sucursal' : ', máximo una al día'}.
          </li>
          {pideTicket && <li>Te pueden pedir el ticket de tu compra para registrar la visita.</li>}
          <li>Si una compra se cancela o se devuelve, se retira la estampa que dio.</li>
        </ul>
      </Seccion>

      <Seccion n={4} titulo="Premios">
        <ul className="grid list-disc gap-1.5 pl-5">
          {hitos.map((h) => (
            <li key={h.posicion}>
              Con <b className="font-semibold text-ink">{h.posicion} estampas</b>:{' '}
              {h.nombre.toLowerCase()}
              {h.incluye ? ` (${h.incluye.replace(/\.$/, '').toLowerCase()})` : ''}.
            </li>
          ))}
          <li>Al completar tu tarjeta empiezas una nueva.</li>
          <li>
            Para cobrar un premio, verifica tu celular o tu correo desde tu tarjeta. Cada premio se
            entrega una vez y no se cambia por dinero.
          </li>
        </ul>
      </Seccion>

      <Seccion n={5} titulo="Cambios y fin del programa">
        <p>
          {nombre} puede cambiar estas reglas o terminar el programa. Los cambios se publican en
          esta página y no te quitan las estampas ni los premios que ya ganaste. Si el programa
          termina, {nombre} te dirá hasta cuándo puedes cobrar los premios que ya tengas.
        </p>
      </Seccion>

      <Seccion n={6} titulo="Uso indebido">
        <p>
          Si una tarjeta se usa para sumar visitas que no ocurrieron, {nombre} puede quitarle esas
          estampas o cancelarla.
        </p>
      </Seccion>

      <Seccion n={7} titulo="Dudas">
        <p>
          Si algo no cuadra en tu tarjeta,{' '}
          {correo || whatsapp ? (
            <>
              escríbenos
              {correo ? ` a ${correo}` : ''}
              {correo && whatsapp ? ' o' : ''}
              {whatsapp ? ` por WhatsApp al +${whatsapp}` : ''}
            </>
          ) : (
            'pregúntanos en el negocio'
          )}
          .
        </p>
      </Seccion>

      <Seccion n={8} titulo="Mensajes y datos personales">
        <p>
          Te mandamos avisos de tu tarjeta, como códigos de verificación. Promociones, solo si las
          aceptaste; puedes quitarlas desde tu perfil. Cómo tratamos tus datos está en el{' '}
          <a href="/lealtad/privacidad" className="text-crust-dark underline underline-offset-2">
            aviso de privacidad
          </a>
          .
        </p>
      </Seccion>

      <Seccion n={9} titulo="Leyes">
        <p>
          Estas reglas se rigen por las leyes de México. Si tienes un problema que no se resuelve
          con {nombre}, puedes acudir a la Procuraduría Federal del Consumidor (Profeco).
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
