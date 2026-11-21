import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { programaVigente } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirSesion } from '@/lib/admin/sesion';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Ayuda' };
export const dynamic = 'force-dynamic';

/**
 * Manual del negocio, escrito con sus propios datos: su nombre, sus
 * direcciones, sus premios y sus reglas. El personal de sucursal ve solo la
 * parte de caja; la dirección ve también la suya. Se puede imprimir.
 */
export default async function AyudaPage() {
  const sesion = await exigirSesion();
  const [negocio, programa, base] = await Promise.all([
    exigirNegocio(),
    programaVigente(),
    origenDeLaPeticion(),
  ]);
  const hitos = [...programa.hitos].sort((a, b) => a.posicion - b.posicion);
  const folioObligatorio = negocio.ajustes.comprobanteConQr === 'OBLIGATORIO';
  const direccion = sesion.rol !== 'SUCURSAL';
  const administra = sesion.rol === 'ADMIN' || sesion.rol === 'DUENO';
  const sitio = base.replace(/^https?:\/\//, '');

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/ayuda"
      titulo="Ayuda"
      descripcion={`Cómo se usa el programa de ${negocio.nombre}. Imprímelo desde el navegador si lo quieres en papel.`}
    >
      <div className="grid max-w-3xl gap-12">
        <Capitulo titulo="En caja">
          <p>
            La caja se abre en <Ruta>{sitio}/admin/lealtad/caja</Ruta> desde cualquier celular,
            tableta o computadora.
          </p>

          <Tarea titulo="Registrar una visita">
            <li>Toca «Registrar visita».</li>
            <li>
              Escanea el código de la tarjeta del cliente. Si la cámara no lo lee, escribe el
              código: empieza con {negocio.prefijoCodigo}-.
            </li>
            {negocio.ajustes.comprobanteConQr === 'NO_PEDIR' ? (
              <li>Toca «Sumar estampa». La tarjeta del cliente la muestra al momento.</li>
            ) : (
              <>
                <li>
                  {folioObligatorio
                    ? 'Escribe el folio del ticket o tómale foto. Sin folio ni foto, la visita no se registra.'
                    : 'Pide el ticket y escribe su folio. Si el cliente no lo trae, registra la visita de todos modos: queda anotada sin folio.'}
                </li>
                <li>Confirma. La tarjeta del cliente muestra su estampa nueva al momento.</li>
              </>
            )}
          </Tarea>
          <p>
            Cada tarjeta suma una estampa por día en cada sucursal. Si ya sumó hoy aquí, la caja lo
            avisa y no registra otra.
          </p>

          <Tarea titulo="Entregar un premio">
            <li>Toca «Entregar premio» y escanea la tarjeta.</li>
            <li>Elige el premio, entrégalo y marca que lo entregaste.</li>
            <li>Confirma. Cada premio se entrega una sola vez.</li>
          </Tarea>
          <p>
            Para cobrar un premio, el cliente necesita su celular o su correo verificado. Si la caja
            lo pide, que lo verifique desde su tarjeta, o mándale su enlace por WhatsApp o correo
            desde la misma pantalla.
          </p>

          <Tarea titulo="El cliente no trae su tarjeta">
            <li>Toca «Registrar visita sin tarjeta».</li>
            <li>Búscalo por su celular o su correo. Si no tiene tarjeta, se crea ahí mismo.</li>
            {negocio.ajustes.comprobanteSinTarjeta === 'OBLIGATORIO' && (
              <li>En este caso el folio o la foto del ticket sí son obligatorios.</li>
            )}
          </Tarea>
        </Capitulo>

        <Capitulo titulo="Lo que le dices al cliente">
          <ul className="grid list-disc gap-1.5 pl-5">
            <li>
              Crea tu tarjeta escaneando el código del mostrador o en <Ruta>{sitio}/lealtad</Ruta>.
              No se instala nada.
            </li>
            {hitos.map((h) => (
              <li key={h.posicion}>
                A las {h.posicion} estampas: {h.nombre.toLowerCase()}.
              </li>
            ))}
            <li>
              Al completar las {programa.posiciones} empieza una tarjeta nueva. Estampas y premios
              no vencen.
            </li>
          </ul>
        </Capitulo>

        {direccion && (
          <Capitulo titulo="Para quien dirige el negocio">
            <Tarea titulo="Antes de abrir el programa al público">
              {administra && (
                <li>
                  En <b>Marca</b>: tu nombre, tus colores, tus logotipos y tus datos de contacto.
                </li>
              )}
              <li>
                En <b>Programa</b>, pestaña «Programa»: cuántas estampas y qué premios.
              </li>
              <li>
                En <b>Programa</b>, pestaña «Sucursales y códigos»: enciende cada sucursal e imprime
                su cartel con el código para el mostrador.
              </li>
              {administra && (
                <li>
                  En <b>Usuarios</b>: una cuenta de rol Sucursal por cada persona de caja. Cada
                  quien recibe un enlace para elegir su contraseña.
                </li>
              )}
              <li>Haz una visita de prueba con tu propio celular, de principio a fin.</li>
            </Tarea>

            <Tarea titulo="Cada semana">
              <li>
                Revisa <b>Programa</b>, pestaña «Pendientes»: visitas que la caja dejó para
                revisión. Apruébalas o recházalas.
              </li>
              <li>
                Mira el <b>Resumen</b> y la <b>Analítica</b>: tarjetas nuevas, clientes que
                volvieron y premios entregados.
              </li>
            </Tarea>

            <p>
              Cambiar el programa crea una versión nueva: lo que tus clientes ya ganaron conserva el
              premio con el que lo ganaron.
            </p>
            <p>
              Los términos del programa y el aviso de privacidad son plantillas con tus datos.
              Revísalos con tu abogado antes de abrir al público.
            </p>
          </Capitulo>
        )}
      </div>
    </MarcoPanel>
  );
}

function Capitulo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 text-[16px] text-ink-soft">
      <h2 className="text-3xl text-ink">{titulo}</h2>
      {children}
    </section>
  );
}

function Tarea({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-rule pt-4">
      <h3 className="text-xl text-ink">{titulo}</h3>
      <ol className="grid list-decimal gap-1.5 pl-5">{children}</ol>
    </div>
  );
}

function Ruta({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[14px] break-all text-ink">{children}</span>;
}
