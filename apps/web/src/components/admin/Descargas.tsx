import { Icono } from './Icono';

const BOTON =
  'inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] border-ink px-4 text-[14px] font-semibold text-ink hover:bg-ink hover:text-cream';

/** «Descargar clientes» (Excel) para la lista de clientes. */
export function DescargarClientes({ base }: { base: string }) {
  return (
    <a href={`${base}/admin/exportar?que=clientes`} download className={BOTON}>
      <Icono nombre="descargar" tam={18} />
      Descargar (Excel)
    </a>
  );
}

/** Descargar las visitas de un periodo, para Excel. */
export function DescargarVisitas({ base }: { base: string }) {
  return (
    <form
      action={`${base}/admin/exportar`}
      method="get"
      data-descarga
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="que" value="visitas" />
      <label className="sr-only" htmlFor="descargar-dias">
        Periodo de las visitas
      </label>
      <select
        id="descargar-dias"
        name="dias"
        defaultValue="90"
        className="min-h-[44px] rounded-full border-[1.5px] border-[#E8D8C6] bg-white px-3 text-[14px] text-ink"
      >
        <option value="30">Últimos 30 días</option>
        <option value="90">Últimos 90 días</option>
        <option value="365">Último año</option>
        <option value="todas">Todas</option>
      </select>
      <button type="submit" className={BOTON}>
        <Icono nombre="descargar" tam={18} />
        Descargar visitas
      </button>
    </form>
  );
}
