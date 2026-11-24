import type { Metadata } from 'next';
import { ingresoRecurrente, ingresosPorMes, listarPagos, renovacionesProximas } from '@wl/database';

import { negociosDelPanel } from '@/lib/plataforma/panel';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { AvisoDeAccion, ListaPagos, Panel, pesosDeCentavos } from '../piezas';

export const metadata: Metadata = { title: 'Ingresos' };
export const dynamic = 'force-dynamic';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (clave: string) => {
  const [anio, mes] = clave.split('-').map(Number);
  return `${MESES[(mes ?? 1) - 1]} ${String(anio).slice(2)}`;
};
const fecha = (d: Date) =>
  d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long' });

function CifraDinero({
  etiqueta,
  valor,
  contexto,
}: {
  etiqueta: string;
  valor: string;
  contexto: string;
}) {
  return (
    <div className="rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white p-5">
      <p className="text-[14px] font-semibold text-[#5A4F63]">{etiqueta}</p>
      <p className="mt-1 font-display text-[30px] leading-none font-semibold text-ink tabular-nums">
        {valor}
      </p>
      <p className="mt-2 text-[13px] text-[#5A4F63]">{contexto}</p>
    </div>
  );
}

/** Lo cobrado (registrado a mano en cada ficha), el mes en curso y lo que vence pronto. */
export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [negocios, meses, pagos, { aviso }] = await Promise.all([
    negociosDelPanel(),
    ingresosPorMes(6),
    listarPagos({ limite: 50 }),
    searchParams,
  ]);
  const recurrente = await ingresoRecurrente(negocios);
  const renovaciones = renovacionesProximas(negocios, 30);
  const actual = meses.at(-1)!;
  const anterior = meses.at(-2)!;
  const maximo = Math.max(1, ...meses.map((m) => m.centavos));
  const diferencia = actual.centavos - anterior.centavos;

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="ingresos"
      titulo="Ingresos"
      descripcion="Lo que se registra en la ficha de cada club al cobrar (con IVA). Hoy el cobro es por enlace de WhatsApp: si un pago no se registró aquí, no cuenta."
      acciones={
        <a
          href="/plataforma/exportar?que=pagos"
          download
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-cream"
        >
          Descargar pagos
        </a>
      }
    >
      <div className="mb-5 empty:hidden">
        <AvisoDeAccion aviso={aviso} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CifraDinero
          etiqueta="Este mes"
          valor={pesosDeCentavos(actual.centavos)}
          contexto={`${actual.pagos} ${actual.pagos === 1 ? 'pago' : 'pagos'} · ${diferencia >= 0 ? '+' : '−'}${pesosDeCentavos(Math.abs(diferencia))} vs. el mes pasado`}
        />
        <CifraDinero
          etiqueta="Mes pasado"
          valor={pesosDeCentavos(anterior.centavos)}
          contexto={`${anterior.pagos} ${anterior.pagos === 1 ? 'pago' : 'pagos'}`}
        />
        <CifraDinero
          etiqueta="Recurrente estimado"
          valor={`${pesosDeCentavos(recurrente.centavosAlMes)}/mes`}
          contexto={
            recurrente.sinImporte > 0
              ? `${recurrente.clubes} clubes al día · ${recurrente.sinImporte} pagados sin importe registrado`
              : `${recurrente.clubes} ${recurrente.clubes === 1 ? 'club al día' : 'clubes al día'}; un año cuenta como 1/12`
          }
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Panel icono="numeros" titulo="Últimos 6 meses">
          <ol className="grid gap-2.5" aria-label="Ingreso por mes">
            {meses.map((m) => (
              <li key={m.mes} className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-3">
                <span className="text-[14px] text-[#5A4F63]">{nombreMes(m.mes)}</span>
                <span className="h-[14px] overflow-hidden rounded-full bg-crumb">
                  <span
                    className="block h-full rounded-full bg-[#120A2A]"
                    style={{ width: `${Math.round((m.centavos / maximo) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-[14px] font-semibold text-ink tabular-nums">
                  {pesosDeCentavos(m.centavos)}
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel
          icono="reloj"
          titulo="Renovaciones en 30 días"
          aviso={renovaciones.some((r) => r.dias <= 3)}
          contador={renovaciones.length > 0 ? String(renovaciones.length) : undefined}
        >
          {renovaciones.length === 0 ? (
            <p className="text-[15px] text-[#5A4F63]">Nada vence en los próximos 30 días.</p>
          ) : (
            <ul className="grid text-[15px]">
              {renovaciones.map((r) => {
                const { negocio } = r.fila;
                const whatsapp = negocio.ajustes.alta?.whatsapp;
                const servicio = r.concepto === 'ARCADE' ? 'Juega y gana' : 'tu club';
                const texto = `Hola: ${servicio} de ${negocio.nombre} en club-lealtad ${r.dias < 0 ? 'venció' : 'vence'} el ${fecha(r.vence)}. ¿Te paso el enlace para renovarlo?`;
                return (
                  <li
                    key={`${negocio.id}-${r.concepto}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[#EFE3D3] py-2.5 first:border-t-0"
                  >
                    <span className="grid gap-0.5">
                      <a
                        href={`/plataforma/${negocio.slug}#pagos`}
                        className="font-semibold text-ink underline decoration-[#E8D8C6] underline-offset-4"
                      >
                        {negocio.nombre}
                      </a>
                      <span
                        className={`text-[13px] ${r.dias <= 3 ? 'font-semibold text-[#8C231B]' : 'text-[#5A4F63]'}`}
                      >
                        {r.concepto === 'ARCADE' ? 'Juega y gana' : 'Lite'} ·{' '}
                        {r.dias < 0
                          ? `venció hace ${-r.dias} ${r.dias === -1 ? 'día' : 'días'}`
                          : r.dias === 0
                            ? 'vence hoy'
                            : `vence en ${r.dias} ${r.dias === 1 ? 'día' : 'días'} (${fecha(r.vence)})`}
                      </span>
                    </span>
                    {whatsapp && (
                      <a
                        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[40px] items-center rounded-full border border-rule px-4 text-[14px] text-ink hover:border-ink"
                      >
                        WhatsApp
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div id="pagos" className="mt-6">
        <Panel
          icono="dinero"
          titulo="Pagos registrados"
          contador={pagos.length > 0 ? String(pagos.length) : undefined}
        >
          <ListaPagos pagos={pagos} conClub />
        </Panel>
      </div>
    </MarcoPlataforma>
  );
}
