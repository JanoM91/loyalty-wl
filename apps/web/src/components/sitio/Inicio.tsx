import Link from 'next/link';

import { SelectorGiros, TarjetaDemo } from './Interactivos';
import { Cierre, Cinta, Marco, Pasos, Revela, Seccion, enlaceWhatsApp, minimo } from './Marco';

/** Inicio de club-lealtad.com: presenta el servicio a dueños de negocio. */
export function Inicio() {
  return (
    <Marco>
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="orbs par" aria-hidden="true">
          <span className="orb a" style={{ width: 520, height: 520, left: -180, top: -200 }} />
          <span className="orb b s2" style={{ width: 200, height: 200, left: '42%', top: 30 }} />
          <span className="orb c s3" style={{ width: 120, height: 120, left: '30%', bottom: 20 }} />
          <span className="orb b s3" style={{ width: 90, height: 90, right: '4%', bottom: 60 }} />
        </div>
        <div className="wrap row" style={{ gap: 56, paddingTop: 80, paddingBottom: 104 }}>
          <div className="col" style={{ flex: '1 1 520px', minWidth: 0, gap: 26 }}>
            <span className="chip">Lealtad digital, fácil</span>
            <h1 className="d h1">Tus clientes vuelven. Tú sabes quiénes son.</h1>
            <p className="lead">Tarjeta de sellos en su celular. Sin app. Sin papel.</p>
            <div className="row" style={{ gap: '12px 26px' }}>
              <a href={enlaceWhatsApp()} className="btn">
                Agenda una demo
              </a>
              <Link href="/como-funciona" className="lk">
                Ver cómo funciona
              </Link>
            </div>
          </div>
          <TarjetaDemo />
        </div>
      </section>
      <Cinta />

      <Seccion separacion={44}>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          El cartón se pierde. Esto no.
        </h2>
        <div className="grid" style={minimo(300)}>
          <Revela
            titulo="No sabes quién vuelve"
            pie="Antes"
            detras="Cada tarjeta tiene nombre y celular. Ves quién viene y quién dejó de venir."
          />
          <Revela
            titulo="Sellos de mentira"
            pie="Antes"
            detras="Cada estampa se escanea en caja y queda registrada con el folio del ticket."
          />
          <Revela
            titulo="Descuentos que duelen"
            pie="Antes"
            detras="Premias la costumbre de volver, no regalas tu margen."
          />
        </div>
      </Seccion>

      <Seccion oscura separacion={40}>
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px 40px' }}
        >
          <h2 className="d h2 rise">Tres pasos</h2>
          <Link href="/como-funciona" className="lk">
            Recorrido completo
          </Link>
        </div>
        <Pasos
          min={300}
          items={[
            ['Saca su tarjeta', 'Con su celular, desde tu QR. Va directo a su Wallet.'],
            ['Escaneas su QR', 'Tu caja sella la visita en segundos.'],
            ['El premio avisa', 'Su teléfono le recuerda que ya ganó.'],
          ]}
        />
      </Seccion>

      <Seccion>
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px 40px' }}
        >
          <h2 className="d h2 rise" style={{ maxWidth: '11em' }}>
            Un club para cada negocio
          </h2>
          <Link href="/negocios" className="lk">
            Ver todos los giros
          </Link>
        </div>
        <SelectorGiros />
      </Seccion>

      <Seccion oscura separacion={40}>
        <div className="col" style={{ gap: 18 }}>
          <span className="chip">Servicio adicional</span>
          <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
            Gamificación: volver se siente como ganar
          </h2>
        </div>
        <div className="grid" style={minimo(240)}>
          <Revela
            titulo="Retos"
            pie="Frecuencia"
            detras="3 visitas en 30 días y la siguiente estampa vale doble."
          />
          <Revela
            titulo="Rachas"
            pie="Constancia"
            detras="Una visita cada semana. Nadie quiere romper su racha."
          />
          <Revela
            titulo="Niveles"
            pie="Permanencia"
            detras="Bronce, Plata y Oro, con un beneficio por nivel."
          />
          <Revela
            titulo="Insignias"
            pie="Variedad"
            detras="Probó tres panes nuevos. Visitó las dos sucursales."
          />
        </div>
        <Link href="/gamificacion" className="lk" style={{ alignSelf: 'flex-start' }}>
          Ver las mecánicas
        </Link>
      </Seccion>

      <Seccion separacion={40}>
        <h2 className="d h2 rise">Dos planes</h2>
        <div className="grid" style={minimo(380, { gap: 24 })}>
          <Link href="/planes" className="col plan rise" style={{ textDecoration: 'none' }}>
            <span className="d" style={{ fontSize: 54, fontWeight: 800 }}>
              Lite
            </span>
            <span className="p">
              Tu club en club-lealtad.com/tu-negocio. Tu logo, tus colores, tus premios.
            </span>
            <span className="lk" style={{ marginTop: 'auto' }}>
              Ver Lite
            </span>
          </Link>
          <Link href="/planes" className="col plan x rise" style={{ textDecoration: 'none' }}>
            <span className="d" style={{ fontSize: 54, fontWeight: 800 }}>
              Privada
            </span>
            <span className="p">Tu dominio, diseño a la medida y acompañamiento.</span>
            <span className="lk" style={{ marginTop: 'auto' }}>
              Ver Privada
            </span>
          </Link>
        </div>
      </Seccion>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap col" style={{ maxWidth: 860, gap: 28 }}>
          <h2 className="d h2 rise">Dudas rápidas</h2>
          <div className="col" style={{ borderBottom: '1.5px solid var(--ink)' }}>
            <details className="faq">
              <summary>¿Mis clientes descargan una app?</summary>
              <p>No. La tarjeta abre en el navegador y se guarda en su Wallet.</p>
            </details>
            <details className="faq">
              <summary>¿Cambio mi caja o punto de venta?</summary>
              <p>No. Se escanea desde un celular o tablet.</p>
            </details>
            <details className="faq">
              <summary>¿Sirve con varias sucursales?</summary>
              <p>Sí. Una cuenta de caja por sucursal y la misma tarjeta en todas.</p>
            </details>
            <details className="faq">
              <summary>¿Cuánto cuesta?</summary>
              <p>Depende del plan y de tus sucursales. Te cotizamos en la demo.</p>
            </details>
          </div>
        </div>
      </section>

      <Cierre titulo="Mira tu tarjeta con tu marca" />
    </Marco>
  );
}
