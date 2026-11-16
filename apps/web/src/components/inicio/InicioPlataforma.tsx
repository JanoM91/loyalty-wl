import { PROGRAMA_BASE } from '@wl/domain';

import { TarjetaSellos } from '@/components/lealtad/TarjetaSellos';

/**
 * Página de inicio del sitio compartido: presenta el servicio a los negocios,
 * explica las dos modalidades y lista los programas que ya viven aquí.
 *
 * El nombre del sitio sale de `WL_NOMBRE_SITIO` (todavía por definir) y el
 * contacto, de `WL_CONTACTO_WHATSAPP`. No hay precios: no están definidos.
 */
export function InicioPlataforma({
  negocios,
}: {
  negocios: readonly { slug: string; nombre: string; frase: string }[];
}) {
  const sitio = process.env.WL_NOMBRE_SITIO?.trim() || 'Loyalty WL';
  const whatsapp = (process.env.WL_CONTACTO_WHATSAPP ?? '').replace(/\D/g, '');
  const contacto = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero un programa de lealtad para mi negocio.`)}`
    : null;

  const modalidades = [
    {
      nombre: 'Lite',
      resumen: 'Tu programa listo, dentro de este sitio.',
      incluye: [
        'Tu dirección propia aquí: /tu-negocio',
        'Tu logotipo, tus colores, tus premios y tus reglas',
        'Caja para tu personal y tarjeta digital para tus clientes',
        'Reportes esenciales de visitas y premios',
        'Campañas a tus clientes, operadas por nosotros',
      ],
    },
    {
      nombre: 'Privada',
      resumen: 'Tu programa en tu dominio, hecho a tu medida.',
      incluye: [
        'Dominio propio con página de inicio de tu negocio',
        'Instalación y base de datos solo tuyas',
        'Diseño exclusivo para tu marca',
        'Campañas y reportes completos, en tus manos',
        'Acompañamiento en el arranque y la operación',
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20">
      <header className="flex items-center justify-between gap-4 py-5">
        <span className="font-display text-[21px] font-bold">{sitio}</span>
        {contacto ? (
          <a
            href={contacto}
            className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-semibold text-cream"
          >
            Quiero el mío
          </a>
        ) : null}
      </header>

      <main id="contenido" className="grid gap-24 pt-10">
        <section className="grid items-center gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="grid gap-6">
            <h1 className="text-[clamp(2.75rem,8vw,5rem)] text-balance">
              La tarjeta de sellos de tu negocio, en el celular de tus clientes
            </h1>
            <p className="max-w-[42ch] text-[18px] text-muted">
              Tus clientes juntan estampas en cada visita y cobran su premio en caja. Sin
              aplicaciones que instalar ni tarjetas de cartón que se pierden.
            </p>
            {contacto ? (
              <a
                href={contacto}
                className="inline-flex min-h-[56px] items-center justify-self-start rounded-full bg-ink px-8 text-[17px] font-semibold text-cream"
              >
                Escríbenos por WhatsApp
              </a>
            ) : null}
          </div>
          <div aria-hidden="true" className="mx-auto w-full max-w-sm">
            <TarjetaSellos
              datos={{ estampas: 4, ciclo: 1, nombre: 'Tu negocio' }}
              programa={PROGRAMA_BASE}
            />
          </div>
        </section>

        <section className="grid gap-8">
          <h2 className="text-3xl">Así funciona</h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {[
              [
                'Armamos tu programa',
                'Cuántas visitas, qué premios y con qué reglas. Con tu marca.',
              ],
              ['Tu cliente crea su tarjeta', 'Escanea el código de tu mostrador con su celular.'],
              [
                'Tu caja sella y entrega',
                'Cada visita es una estampa; el premio se cobra ahí mismo.',
              ],
            ].map(([titulo, texto], i) => (
              <li key={titulo} className="grid gap-2 border-t border-rule pt-4">
                <span className="font-display text-2xl text-muted tabular-nums">{i + 1}</span>
                <b className="text-[19px] font-semibold">{titulo}</b>
                <span className="text-[15px] text-muted">{texto}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-8">
          <h2 className="text-3xl">Dos formas de tenerlo</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {modalidades.map((m, i) => (
              <article
                key={m.nombre}
                className={`grid content-start gap-5 rounded-xl p-7 ${i === 1 ? 'bg-ink text-cream' : 'border border-rule bg-cream'}`}
              >
                <div className="grid gap-1">
                  <h3 className="text-4xl">{m.nombre}</h3>
                  <p className={i === 1 ? 'text-cream/75' : 'text-muted'}>{m.resumen}</p>
                </div>
                <ul className="grid gap-2.5 text-[16px]">
                  {m.incluye.map((x) => (
                    <li
                      key={x}
                      className={`border-t pt-2.5 ${i === 1 ? 'border-cream/20' : 'border-rule'}`}
                    >
                      {x}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {negocios.length > 0 && (
          <section className="grid gap-6">
            <h2 className="text-3xl">Programas que ya viven aquí</h2>
            <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
              {negocios.map((n) => (
                <li key={n.slug} className="border-t border-rule">
                  <a href={`/${n.slug}`} className="grid gap-0.5 py-4">
                    <b className="text-[18px] font-semibold">{n.nombre}</b>
                    {n.frase ? <span className="text-[14px] text-muted">{n.frase}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="mt-24 border-t border-rule pt-6 text-[14px] text-muted">
        {sitio} es un servicio de Exkalibur Consulting.
      </footer>
    </div>
  );
}
