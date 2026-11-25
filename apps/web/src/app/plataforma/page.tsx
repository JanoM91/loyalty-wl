import type { Metadata } from 'next';
import {
  borradoAutomaticoEncendido,
  clubesEnPausa,
  solicitudesPrivadaPendientes,
  type NegocioEnLista,
} from '@wl/database';
import { diasRestantesDePrueba } from '@wl/domain';

import { Icono } from '@/components/admin/Icono';
import {
  RUTA_CLUBES,
  estadoDelClub,
  fechaDeHoy,
  negociosDelPanel,
  saludo,
  type EstadoClub,
} from '@/lib/plataforma/panel';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from './Marco';
import { borradoAutomatico } from './acciones';
import { Cifra, Panel, RenglonClub, TarjetaAcceso } from './piezas';

export const metadata: Metadata = { title: 'Inicio' };
export const dynamic = 'force-dynamic';

const DIA = 86_400_000;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Sin acentos y en minúsculas, para buscar «cafe» y encontrar «Café». */
const plano = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FILTROS: readonly { id: EstadoClub | 'todos'; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'activo', texto: 'Activos' },
  { id: 'prueba', texto: 'En prueba' },
  { id: 'pausa', texto: 'En pausa' },
  { id: 'suspendido', texto: 'Suspendidos' },
];

export default async function PlataformaPage({
  searchParams,
}: {
  searchParams: Promise<{ borrado?: string; vista?: string; estado?: string; q?: string }>;
}) {
  const sesion = await exigirPlataforma();
  const [negocios, automatico, { borrado, vista, estado, q }] = await Promise.all([
    negociosDelPanel(),
    borradoAutomaticoEncendido(),
    searchParams,
  ]);
  const ahora = new Date();
  const por = (e: EstadoClub) => negocios.filter((f) => estadoDelClub(f, ahora) === e);
  const aviso = borrado && (
    <p role="status" className="mb-6 rounded-[14px] bg-ink px-4 py-3 text-[15px] text-cream">
      Se borró /{borrado} con todos sus datos.
    </p>
  );

  if (vista === 'clubes') {
    const filtro = FILTROS.find((f) => f.id === estado)?.id ?? 'todos';
    const texto = plano((q ?? '').trim());
    const visibles = negocios.filter((f) => {
      if (filtro !== 'todos' && estadoDelClub(f, ahora) !== filtro) return false;
      if (!texto) return true;
      const { nombre, slug, ajustes } = f.negocio;
      return plano(`${nombre} ${slug} ${ajustes.alta?.correo ?? ''}`).includes(texto);
    });
    const enlace = (id: string) =>
      `${RUTA_CLUBES}${id === 'todos' ? '' : `&estado=${id}`}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    return (
      <MarcoPlataforma
        sesion={sesion}
        actual="clubes"
        titulo="Clubes"
        descripcion={`${plural(negocios.length, 'programa', 'programas')} de lealtad.`}
        acciones={
          <span className="flex flex-wrap gap-2">
            <a
              href="/plataforma/exportar"
              download
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-cream"
            >
              <Icono nombre="descargar" tam={18} />
              Descargar
            </a>
            <a
              href="/plataforma/nuevo"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-cream"
            >
              <Icono nombre="nuevo" tam={18} />
              Nuevo club
            </a>
          </span>
        }
      >
        {aviso}
        <form action="/plataforma" className="flex flex-wrap gap-3">
          <input type="hidden" name="vista" value="clubes" />
          {filtro !== 'todos' && <input type="hidden" name="estado" value={filtro} />}
          <label className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-[16px] border-[1.5px] border-[#E8D8C6] bg-white px-4 text-ink focus-within:border-ink">
            <Icono nombre="buscar" tam={20} className="flex-none" />
            <span className="sr-only">Filtrar por nombre, dirección o correo del dueño</span>
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder="Nombre, dirección o correo del dueño"
              className="min-h-[48px] min-w-0 flex-1 border-0 bg-transparent text-[16px] outline-none placeholder:text-[#5A4F63]"
            />
          </label>
          <button
            type="submit"
            className="min-h-[52px] rounded-[16px] border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-cream"
          >
            Filtrar
          </button>
        </form>

        <nav aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const n = f.id === 'todos' ? negocios.length : por(f.id).length;
            const on = f.id === filtro;
            return (
              <a
                key={f.id}
                href={enlace(f.id)}
                aria-current={on ? 'true' : undefined}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] px-4 text-[14px] font-semibold ${on ? 'border-ink bg-ink text-cream' : 'border-[#E8D8C6] bg-white text-ink hover:border-ink'}`}
              >
                {f.texto}
                <span className={on ? 'text-cream/75' : 'text-[#5A4F63]'}>{n}</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-5 rounded-[20px] border-[1.5px] border-[#E8D8C6] bg-white p-3 sm:p-4">
          {visibles.length === 0 ? (
            <p className="px-2 py-6 text-[15px] text-[#5A4F63]">
              {negocios.length === 0 ? (
                <>
                  Todavía no hay clubes.{' '}
                  <a href="/plataforma/nuevo" className="text-ink underline underline-offset-4">
                    Crea el primero.
                  </a>
                </>
              ) : (
                <>
                  Ningún club con ese filtro.{' '}
                  <a href={RUTA_CLUBES} className="text-ink underline underline-offset-4">
                    Ver todos.
                  </a>
                </>
              )}
            </p>
          ) : (
            <ul>
              {visibles.map((f) => (
                <RenglonClub key={f.negocio.id} fila={f} />
              ))}
            </ul>
          )}
        </div>
      </MarcoPlataforma>
    );
  }

  const [pausados, quierenPrivada] = await Promise.all([
    clubesEnPausa(ahora, negocios),
    solicitudesPrivadaPendientes(),
  ]);
  const listos = pausados.filter((c) => c.listo);
  const enPrueba = por('prueba')
    .map((f) => ({ fila: f, dias: diasRestantesDePrueba(f.negocio.ajustes.pruebaVence, ahora) }))
    .sort((a, b) => a.dias - b.dias);
  const porVencer = enPrueba.filter((p) => p.dias <= 3);
  const activos = por('activo');
  const nuevos = negocios.filter((f) => ahora.getTime() - f.creado.getTime() < 7 * DIA).length;
  const tarjetas = negocios.reduce((suma, f) => suma + f.tarjetas, 0);
  const recientes: NegocioEnLista[] = negocios.slice(0, 5);
  const nombre = sesion.nombre.trim().split(/\s+/)[0] ?? '';

  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="inicio"
      antetitulo={fechaDeHoy(ahora)}
      titulo={nombre ? `${saludo(ahora)}, ${nombre}` : saludo(ahora)}
      buscadorGrande
    >
      {aviso}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <TarjetaAcceso
          principal
          href="/plataforma/nuevo"
          icono="nuevo"
          titulo="Nuevo club"
          linea="Darlo de alta en una pantalla"
        />
        <TarjetaAcceso
          href={RUTA_CLUBES}
          icono="tienda"
          titulo="Clubes"
          linea={`${plural(negocios.length, 'programa', 'programas')} de lealtad`}
        />
        <TarjetaAcceso
          href={`${RUTA_CLUBES}&estado=prueba`}
          icono="reloj"
          titulo="En prueba"
          linea={
            enPrueba.length === 0
              ? 'Ninguno por ahora'
              : `${enPrueba.length} · ${porVencer.length} ${porVencer.length === 1 ? 'termina' : 'terminan'} en 3 días o menos`
          }
        />
        <TarjetaAcceso
          href={`${RUTA_CLUBES}&estado=pausa`}
          icono="pausa"
          titulo="En pausa"
          linea={
            pausados.length === 0
              ? 'Ninguno por ahora'
              : `${pausados.length} sin prueba ni pago vigente`
          }
        />
        <TarjetaAcceso
          href="/plataforma/actividad"
          icono="pulso"
          titulo="Actividad"
          linea="Uso de cada club y a quién llamar"
        />
        <TarjetaAcceso
          href="/plataforma/ingresos"
          icono="dinero"
          titulo="Ingresos"
          linea="Pagos, el mes y renovaciones"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Cifra
          valor={negocios.length}
          etiqueta="Clubes"
          contexto={`${plural(nuevos, 'nuevo', 'nuevos')} en 7 días`}
        />
        <Cifra valor={activos.length} etiqueta="Activos" contexto="Al día, sin prueba" />
        <Cifra
          valor={enPrueba.length}
          etiqueta="En prueba"
          contexto={
            porVencer.length === 0 ? 'Ninguna termina pronto' : `${porVencer.length} por terminar`
          }
        />
        <Cifra valor={tarjetas} etiqueta="Tarjetas" contexto="De clientes, en todos los clubes" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {quierenPrivada.length > 0 && (
          <Panel
            icono="plan"
            titulo="Quieren pasar a Privada"
            contador={String(quierenPrivada.length)}
            aviso
          >
            <ul className="grid text-[15px]">
              {quierenPrivada.slice(0, 6).map((p) => (
                <li key={p.clubId} className="border-t border-[#EFE3D3] first:border-t-0">
                  <a href={`/plataforma/${p.slug}`} className="grid min-h-[48px] gap-0.5 py-2">
                    <span className="flex flex-wrap items-center justify-between gap-x-3">
                      <span className="font-semibold text-ink underline decoration-[#E8D8C6] underline-offset-4">
                        {p.nombre}
                      </span>
                      <span className="text-[#5A4F63]">
                        {p.fecha.toLocaleDateString('es-MX', {
                          timeZone: 'America/Mexico_City',
                          day: 'numeric',
                          month: 'short',
                        })}
                        {p.quien ? ` · ${p.quien}` : ''}
                      </span>
                    </span>
                    {p.nota && <span className="text-[14px] text-[#5A4F63]">«{p.nota}»</span>}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-[#5A4F63]">
              Desaparece de aquí cuando el club pasa a Privada en su ficha.
            </p>
          </Panel>
        )}
        <Panel
          icono="reloj"
          titulo="Pruebas por terminar"
          contador={enPrueba.length > 0 ? String(enPrueba.length) : undefined}
        >
          {enPrueba.length === 0 ? (
            <p className="text-[15px] text-[#5A4F63]">Hoy no hay clubes en prueba.</p>
          ) : (
            <ul className="grid text-[15px]">
              {enPrueba.slice(0, 6).map(({ fila, dias }) => (
                <li key={fila.negocio.id} className="border-t border-[#EFE3D3] first:border-t-0">
                  <a
                    href={`/plataforma/${fila.negocio.slug}`}
                    className="flex min-h-[48px] flex-wrap items-center justify-between gap-x-3 py-2"
                  >
                    <span className="font-semibold text-ink underline decoration-[#E8D8C6] underline-offset-4">
                      {fila.negocio.nombre}
                    </span>
                    <span className={dias <= 3 ? 'font-semibold text-[#8C231B]' : 'text-[#5A4F63]'}>
                      Termina en {plural(dias, 'día', 'días')} ·{' '}
                      {plural(fila.tarjetas, 'tarjeta', 'tarjetas')}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          aviso={pausados.length > 0}
          icono="pausa"
          titulo="Clubes en pausa"
          contador={pausados.length > 0 ? String(pausados.length) : undefined}
        >
          <p className="max-w-prose text-[14px] text-[#5A4F63]">
            {automatico
              ? 'Cada día a las 4:10 a. m. se borran solos los clubes con 30 días en pausa.'
              : 'Nada se borra solo. Borra a mano desde la ficha de cada club.'}{' '}
            {pausados.length === 0
              ? 'Hoy no hay clubes en pausa.'
              : `${listos.length} ya ${listos.length === 1 ? 'cumplió' : 'cumplieron'} 30 días.`}
          </p>
          {pausados.length > 0 && (
            <ul className="mt-2 grid text-[15px]">
              {pausados.slice(0, 6).map((c) => (
                <li key={c.negocio.id} className="border-t border-[#EBD9A8]">
                  <a
                    href={`/plataforma/${c.negocio.slug}`}
                    className="flex min-h-[48px] flex-wrap items-center justify-between gap-x-3 py-2"
                  >
                    <span className="font-semibold text-ink underline decoration-[#E0B45C] underline-offset-4">
                      {c.negocio.nombre}
                    </span>
                    <span className={c.listo ? 'font-semibold text-[#8C231B]' : 'text-[#5B3B00]'}>
                      {plural(c.diasEnPausa, 'día', 'días')} ·{' '}
                      {plural(c.tarjetas, 'tarjeta', 'tarjetas')}
                      {c.listo ? ' · listo para borrar' : ''}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <form action={borradoAutomatico} className="mt-3">
            <input type="hidden" name="encender" value={automatico ? '0' : '1'} />
            <button
              type="submit"
              aria-pressed={automatico}
              className="min-h-[44px] rounded-full border-[1.5px] border-[#E8D8C6] bg-white px-5 text-[14px] text-ink hover:border-ink"
            >
              Borrado automático: <b>{automatico ? 'encendido' : 'apagado'}</b>
            </button>
          </form>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel
          icono="tienda"
          titulo="Últimos clubes"
          accion={
            <a
              href={RUTA_CLUBES}
              className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-ink"
            >
              Ver todos
              <Icono nombre="chevron" tam={16} />
            </a>
          }
        >
          {recientes.length === 0 ? (
            <p className="text-[15px] text-[#5A4F63]">
              Todavía no hay clubes.{' '}
              <a href="/plataforma/nuevo" className="text-ink underline underline-offset-4">
                Crea el primero.
              </a>
            </p>
          ) : (
            <ul>
              {recientes.map((f) => (
                <RenglonClub key={f.negocio.id} fila={f} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </MarcoPlataforma>
  );
}
