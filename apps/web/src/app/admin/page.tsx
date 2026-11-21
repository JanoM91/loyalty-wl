import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  ROLES_DIRECCION,
  bitacoraLealtad,
  estadoComercialDe,
  prisma,
  resumenLealtad,
} from '@wl/database';
import { diasRestantesDePrueba, fechaDeBorrado, pesos } from '@wl/domain';

import { Icono, type NombreIcono } from '@/components/admin/Icono';
import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { exigirSesion } from '@/lib/admin/sesion';
import { fechaLarga, hora } from '@/lib/lealtad/formato';
import { urlAfiliacion } from '@/lib/lealtad/qr';
import { exigirNegocio, rutaBase, ruta } from '@/lib/negocio';
import { precios } from '@/lib/precios';

export const metadata: Metadata = { title: 'Inicio' };
export const dynamic = 'force-dynamic';

const TARJETA =
  'rounded-[22px] border-[1.5px] border-[#CDE8DC] bg-white shadow-[0_18px_40px_-30px_rgba(6,35,28,.5)]';
const SUAVE = 'text-[#3C5A51]';
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const fechaDia = (d: Date) =>
  d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long' });

/** «tu logotipo», «tu logotipo y tu domicilio», «a, b y c». */
function enLista(cosas: readonly string[]): string {
  if (cosas.length <= 1) return cosas.join('');
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

interface Paso {
  readonly titulo: string;
  readonly texto: string;
  readonly boton: string;
  readonly href: string;
  readonly hecho: boolean;
}

/**
 * Inicio del panel: lo de hoy en una sola pantalla. Los clubes nuevos ven
 * primero «Arranca en 3 pasos»; después, botones grandes para la caja, los
 * números de la semana, lo que está por revisar y los últimos movimientos.
 * Las cuentas de caja no llegan aquí (`exigirSesion()` las manda a la caja);
 * los roles sin acceso al programa van a la ayuda.
 */
export default async function AdminInicioPage() {
  const sesion = await exigirSesion();
  if (!ROLES_DIRECCION.includes(sesion.rol)) redirect(await ruta('/admin/ayuda'));
  const administra = sesion.rol === 'ADMIN' || sesion.rol === 'DUENO';

  const [negocio, base, r, sucursales, movimientos, primeraTarjeta] = await Promise.all([
    exigirNegocio(),
    rutaBase(),
    resumenLealtad(7),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { slug: true, loyaltyEnabled: true },
    }),
    bitacoraLealtad(6),
    // En un club nuevo, la primera tarjeta es la del dueño (paso 1 de «Arranca»).
    prisma.loyaltyCard.findFirst({ orderBy: { createdAt: 'asc' }, select: { publicCode: true } }),
  ]);
  const primera = sucursales.find((s) => s.loyaltyEnabled) ?? sucursales[0] ?? null;
  const unete = primera ? await urlAfiliacion(primera.slug) : `${base}/lealtad`;
  const cartel = primera
    ? `${base}/admin/lealtad/sucursales/cartel/${primera.slug}`
    : `${base}/admin/lealtad/sucursales`;
  const hoy = r.porDia[r.porDia.length - 1];

  // Estado comercial: prueba, pausa o pago.
  const { pruebaVence, pagadoHasta, alta } = negocio.ajustes;
  const comercial = estadoComercialDe(negocio);
  const liteMes = (await precios()).lite.mes;
  let estado: { texto: string; boton: string } | null = null;
  if (comercial === 'PRUEBA') {
    const dias = diasRestantesDePrueba(pruebaVence);
    estado = {
      texto: dias === 1 ? 'Prueba gratis: te queda 1 día' : `Prueba gratis: te quedan ${dias} días`,
      boton: 'Activar',
    };
  } else if (comercial === 'PAUSADO') {
    const borrar = fechaDeBorrado(pruebaVence, pagadoHasta);
    estado = {
      texto: borrar
        ? `Tu club está en pausa. Se guarda hasta el ${fechaDia(borrar)}`
        : 'Tu club está en pausa',
      boton: 'Activar mi club',
    };
  }

  // Lo que falta en «Marca y datos» para que las reglas del club estén completas.
  const { legal, contacto } = negocio.marca;
  const faltan = [
    !negocio.marca.logoUrl && !negocio.marca.logoClaroUrl ? 'tu logotipo' : null,
    !legal.domicilio ? 'tu domicilio' : null,
    !contacto.correo && !contacto.whatsapp ? 'tu contacto' : null,
  ].filter((x): x is string => x !== null);

  // Arranque: solo para los clubes que vienen del asistente.
  const pasos: Paso[] | null = alta
    ? [
        {
          titulo: 'Saca tu propia tarjeta',
          texto: 'Como lo hará tu cliente. Tarda un minuto.',
          boton: 'Sacar mi tarjeta',
          href: unete,
          hecho: r.tarjetas > 0,
        },
        {
          titulo: 'Súmate tu primer sello',
          texto: primeraTarjeta
            ? `La caja abre con tu tarjeta (${primeraTarjeta.publicCode}): solo toca «Sumar sello».`
            : 'En la caja, escanea tu tarjeta.',
          boton: primeraTarjeta ? 'Sumar mi primer sello' : 'Abrir la caja',
          href: primeraTarjeta
            ? `${base}/admin/lealtad/caja?accion=sumar&codigo=${encodeURIComponent(primeraTarjeta.publicCode)}`
            : `${base}/admin/lealtad/caja?accion=sumar`,
          hecho: r.visitas > 0,
        },
        {
          titulo: 'Pon tu QR donde cobras',
          texto: 'Imprímelo o compártelo por WhatsApp.',
          boton: 'Ver mi cartel',
          href: cartel,
          hecho: r.tarjetas > 1,
        },
      ]
    : null;
  const hechos = pasos?.filter((p) => p.hecho).length ?? 0;
  const siguiente = pasos?.findIndex((p) => !p.hecho) ?? -1;
  const arrancando = pasos !== null && siguiente !== -1;

  const maximo = Math.max(1, ...r.porDia.map((d) => d.visitas));
  const etiquetaSemana = r.porDia
    .map((d) => `${DIAS[new Date(`${d.fecha}T12:00:00Z`).getUTCDay()]} ${d.visitas}`)
    .join(', ');
  const ahora = new Date();
  const mismoDia = (d: Date) => fechaLarga(d) === fechaLarga(ahora);

  const accion = (
    href: string,
    icono: NombreIcono,
    texto: string,
    principal: boolean,
    clase = '',
  ) => (
    <a
      href={href}
      className={`flex min-h-[92px] flex-col justify-between rounded-[20px] p-4 transition-transform active:scale-[.97] ${principal ? 'bg-ink text-cream' : 'border-[1.5px] border-ink bg-white text-ink'} ${clase}`}
    >
      <Icono nombre={icono} tam={26} />
      <b className="text-[16px]">{texto}</b>
    </a>
  );

  const cifra = (valor: number, texto: string, nota: string) => (
    <div className={`${TARJETA} flex flex-col gap-0.5 p-3.5 lg:p-4`}>
      <span className="font-display text-[28px] leading-none font-extrabold lg:text-[34px]">
        {valor.toLocaleString('es-MX')}
      </span>
      <span className="text-[14px] font-semibold">{texto}</span>
      <span className={`text-[13px] ${SUAVE}`}>{nota}</span>
    </div>
  );

  return (
    <MarcoPanel sesion={sesion} titulo="Inicio" tituloOculto sinAviso>
      <div className="flex flex-col gap-4">
        {estado && (
          <div className="flex items-center justify-between gap-3 rounded-[16px] bg-ink py-2.5 pr-2.5 pl-4 text-[14px] text-cream">
            <span>{estado.texto}</span>
            {administra && (
              <a
                href={`${base}/admin/plan`}
                className="inline-flex min-h-[40px] flex-none items-center rounded-[11px] bg-[#00C389] px-3 font-bold text-ink"
              >
                {estado.boton}
                {comercial === 'PRUEBA' && liteMes !== null && (
                  <span className="hidden sm:inline">&nbsp;· {pesos(liteMes)}/mes</span>
                )}
              </a>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {arrancando && pasos ? (
              <section aria-labelledby="arranca" className={`${TARJETA} wl-entra p-4 lg:p-5`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="arranca" className="text-[22px]">
                    Arranca en 3 pasos
                  </h2>
                  <span className={`text-[13px] font-semibold ${SUAVE}`}>{hechos} de 3</span>
                </div>
                <div aria-hidden="true" className="mt-3 h-1.5 rounded-full bg-[#CDE8DC]">
                  <div
                    className="h-1.5 rounded-full bg-[#00C389] transition-[width] duration-500"
                    style={{ width: `${Math.max(4, (hechos / 3) * 100)}%` }}
                  />
                </div>
                <ol className="mt-4 flex flex-col gap-4">
                  {pasos.map((p, i) => {
                    const ahoraToca = i === siguiente;
                    return (
                      <li key={p.titulo} className="flex items-start gap-3">
                        {p.hecho ? (
                          <span className="grid size-8 flex-none place-items-center rounded-full bg-[#00C389] text-ink">
                            <Icono nombre="check" tam={18} grosor={2.4} />
                            <span className="sr-only">Hecho:</span>
                          </span>
                        ) : (
                          <span
                            className={`grid size-8 flex-none place-items-center rounded-full font-bold ${ahoraToca ? 'wl-late bg-ink text-cream' : `border-[1.5px] border-[#CDE8DC] bg-crumb ${SUAVE}`}`}
                          >
                            {i + 1}
                          </span>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <div>
                            <b className={`text-[16px] ${p.hecho ? `line-through ${SUAVE}` : ''}`}>
                              {p.titulo}
                            </b>
                            <p className={`text-[14px] leading-snug ${SUAVE}`}>{p.texto}</p>
                          </div>
                          {ahoraToca && (
                            <a
                              href={p.href}
                              className="inline-flex min-h-[48px] items-center self-start rounded-[16px] bg-ink px-5 text-[15px] font-semibold text-cream transition-transform active:scale-[.97]"
                            >
                              {p.boton}
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : pasos && administra && faltan.length > 0 ? (
              <div className="wl-entra flex items-center gap-3 rounded-[18px] bg-[#DDF6EC] px-4 py-3">
                <span className="grid size-8 flex-none place-items-center rounded-full bg-[#00C389] text-ink">
                  <Icono nombre="check" tam={18} grosor={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="text-[15px]">Tu club está en marcha</b>
                  <p className={`text-[13px] ${SUAVE}`}>Te falta {enLista(faltan)}.</p>
                </div>
                <a
                  href={`${base}/admin/marca`}
                  className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[#5B2EFF] underline underline-offset-4"
                >
                  Completar
                </a>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
              {accion(`${base}/admin/lealtad/caja?accion=sumar`, 'sello', 'Sumar sello', true)}
              {accion(
                `${base}/admin/lealtad/caja?accion=premio`,
                'regalo',
                'Entregar premio',
                false,
              )}
              {accion(cartel, 'imprimir', 'Imprimir cartel QR', false, 'hidden lg:flex')}
            </div>

            <section
              aria-label="Tu club en números"
              className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
            >
              {cifra(hoy?.visitas ?? 0, 'Sellos hoy', `${r.visitas} en 7 días`)}
              {cifra(r.tarjetas, 'Tarjetas', `${r.tarjetasNuevas} nuevas en 7 días`)}
              {cifra(r.clientesActivos, 'Volvieron', 'clientes en 7 días')}
              {cifra(
                r.premiosDisponibles,
                r.premiosDisponibles === 1 ? 'Premio listo' : 'Premios listos',
                `${r.premiosEntregados} entregados en 7 días`,
              )}
            </section>

            <section className={`${TARJETA} p-4 lg:p-5`}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[17px] font-semibold">Sellos esta semana</h2>
                <a
                  href={`${base}/admin/lealtad/analitica`}
                  className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[#5B2EFF]"
                >
                  Ver números
                </a>
              </div>
              <div
                role="img"
                aria-label={`Sellos por día: ${etiquetaSemana}.`}
                className="mt-2 flex h-[110px] items-end gap-2"
              >
                {r.porDia.map((d, i) => (
                  <div key={d.fecha} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`wl-entra w-full rounded-[6px] ${i === r.porDia.length - 1 ? 'bg-ink' : 'bg-[#00C389]'}`}
                      style={{
                        height: `${Math.max(4, Math.round((d.visitas / maximo) * 84))}px`,
                        animationDelay: `${i * 40}ms`,
                      }}
                    />
                    <span className={`text-[11px] ${SUAVE}`} aria-hidden="true">
                      {DIAS[new Date(`${d.fecha}T12:00:00Z`).getUTCDay()]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {r.pendientes > 0 && (
              <a
                href={`${base}/admin/lealtad/pendientes`}
                className={`${TARJETA} flex min-h-[64px] items-center gap-3 px-4 py-3 text-ink`}
              >
                <span className="grid size-9 flex-none place-items-center rounded-[12px] bg-[#E6E1FF] text-[#2A1580]">
                  <Icono nombre="revisar" tam={20} />
                </span>
                <span className="flex-1 text-[15px]">
                  <b>
                    {r.pendientes === 1 ? '1 visita espera' : `${r.pendientes} visitas esperan`}
                  </b>{' '}
                  tu revisión
                </span>
                <Icono nombre="chevron" tam={20} />
              </a>
            )}

            <section className={`${TARJETA} px-4 pt-3 pb-1 lg:px-5`}>
              <h2 className="py-1 text-[17px] font-semibold">Últimos movimientos</h2>
              {movimientos.length === 0 ? (
                <p className={`pb-3 text-[14px] ${SUAVE}`}>
                  Aquí verás cada sello y cada premio que entregue tu caja.
                </p>
              ) : (
                <ul>
                  {movimientos.map((m, i) => (
                    <li
                      key={`${m.cuando.toISOString()}-${i}`}
                      className="flex items-center gap-3 border-t-[1.5px] border-[#CDE8DC] py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <b className="block text-[15px]">{m.accion}</b>
                        {m.detalle && (
                          <span className={`block truncate text-[13px] ${SUAVE}`}>{m.detalle}</span>
                        )}
                      </div>
                      <span className={`text-[13px] ${SUAVE}`}>
                        {mismoDia(m.cuando) ? hora(m.cuando) : fechaLarga(m.cuando)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </MarcoPanel>
  );
}
