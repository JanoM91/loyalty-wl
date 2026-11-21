import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { arcadeDeLaTarjeta, listaArcade } from '@wl/database';
import { NOMBRE_LISTA, juegoPorId } from '@wl/domain';

import { Aviso } from '@/components/lealtad/Aviso';
import { Arcade } from '@/components/lealtad/arcade/Arcade';
import { Icono } from '@/components/lealtad/Iconos';
import { NavTarjeta } from '@/components/lealtad/NavTarjeta';
import { esJugable, type IdJugable } from '@/lib/arcade/motor';
import { temaArcade } from '@/lib/lealtad/arcade';
import { fechaLarga } from '@/lib/lealtad/formato';
import { exigirTarjeta } from '@/lib/lealtad/sesion';
import { exigirNegocio, ruta } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Juega y gana' };
export const dynamic = 'force-dynamic';

const ETIQUETA_ESTADO = { CANJEADO: 'Cobrado', VENCIDO: 'Venció' } as const;

/**
 * Arcade del club: juegos de habilidad con los productos y colores del
 * negocio. Jugar con constancia completa retos, y cada reto da una promoción
 * que se cobra en caja con un código.
 *
 * Solo existe si el club tiene el Arcade activo; si no, de vuelta a la tarjeta.
 */
export default async function JuegosPage() {
  const [t, negocio] = await Promise.all([exigirTarjeta(), exigirNegocio()]);
  const a = await arcadeDeLaTarjeta(t.id);
  if (!a.vigente) redirect(await ruta('/lealtad/tarjeta'));

  const lista = a.lista.modo === 'ninguna' ? null : await listaArcade(t.id);
  const juegos = a.juegos
    .filter((id): id is IdJugable => esJugable(id))
    .map((id) => {
      const j = juegoPorId(id)!;
      return { id, nombre: j.nombre, dificultad: j.dificultad };
    });
  const disponibles = a.cupones.filter((c) => c.estado === 'DISPONIBLE');
  const pasados = a.cupones.filter((c) => c.estado !== 'DISPONIBLE');
  const semanales = a.retos.filter((r) => r.periodo === 'semana');
  const mensuales = a.retos.filter((r) => r.periodo === 'mes');

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl text-ink">Juega y gana</h1>
        <p className="text-sm text-ink-soft">
          Completa los retos de {negocio.nombre} y desbloquea promociones.
          {a.racha >= 2 ? ` Llevas ${a.racha} días seguidos jugando.` : ''}
        </p>
      </div>

      {disponibles.length > 0 && (
        <section className="grid gap-2" aria-labelledby="promos">
          <h2 id="promos" className="font-sans text-[11px] font-semibold text-muted">
            Tus promociones
          </h2>
          {disponibles.map((c) => (
            <div key={c.codigo} className="grid gap-1 rounded-lg bg-ink p-4 text-cream">
              <b className="font-display text-lg leading-tight">{c.titulo}</b>
              <span className="font-mono text-2xl font-bold tracking-[0.12em]">{c.codigo}</span>
              <span className="text-xs">
                Muéstralo en caja con tu compra · vence el {fechaLarga(c.vence)}
              </span>
            </div>
          ))}
          {!t.verificada && (
            <Aviso tono="atencion" titulo="Para cobrarlas necesitas verificar tu correo o celular">
              <a
                href={t.correo ? '/lealtad/verificar' : '/lealtad/perfil#correo'}
                className="font-semibold underline"
              >
                {t.correo ? 'Verificar mi correo' : 'Agregar mi correo'}
              </a>
            </Aviso>
          )}
        </section>
      )}

      {juegos.length > 0 ? (
        <Arcade
          tema={temaArcade(negocio, a.productos, a.palabras)}
          juegos={juegos}
          partidasDia={a.partidasDia}
          jugadasHoy={a.jugadasHoy}
          semanal={a.modo === 'semana'}
        />
      ) : (
        <Aviso tono="neutro" titulo="Hoy no hay juegos" icono="reloj">
          {negocio.nombre} está preparando sus juegos. Vuelve pronto.
        </Aviso>
      )}

      {a.retos.length > 0 && (
        <section className="grid gap-2" aria-labelledby="retos">
          <h2 id="retos" className="font-sans text-[11px] font-semibold text-muted">
            Retos
          </h2>
          <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
            {[...semanales, ...mensuales].map((r) => {
              const pct = Math.round((Math.min(r.avance, r.meta) / r.meta) * 100);
              return (
                <li key={r.id} className="grid gap-1.5 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-sm text-ink-soft">
                      <b className="block text-[15px] font-semibold text-ink">{r.texto}</b>
                      Premio: {r.premio}
                    </span>
                    <span
                      className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${r.ganado ? 'bg-disponible/10 text-disponible' : 'bg-crumb text-ink-soft'}`}
                    >
                      {r.ganado
                        ? 'Ganado'
                        : `${r.avance.toLocaleString('es-MX')} de ${r.meta.toLocaleString('es-MX')}`}
                    </span>
                  </div>
                  <span
                    className="h-2 overflow-hidden rounded-full bg-crumb"
                    role="progressbar"
                    aria-label={r.texto}
                    aria-valuemin={0}
                    aria-valuemax={r.meta}
                    aria-valuenow={Math.min(r.avance, r.meta)}
                  >
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${r.ganado ? 100 : pct}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">
            Las partidas cuentan el día que se juegan. Los retos semanales empiezan cada lunes y los
            mensuales el día 1.
          </p>
        </section>
      )}

      {lista && (
        <section className="grid gap-2" aria-labelledby="lista">
          <h2 id="lista" className="font-sans text-[11px] font-semibold text-muted">
            {NOMBRE_LISTA[lista.modo]}
          </h2>
          {lista.filas.length > 0 ? (
            <ol className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream">
              {lista.filas.map((f, i) => (
                <li
                  key={`${f.nombre}-${i}`}
                  className={`flex items-center gap-3 px-3.5 py-2.5 text-sm ${f.esTuya ? 'bg-accent/15' : ''}`}
                >
                  {lista.modo !== 'aleatoria' && (
                    <span className="w-6 flex-none font-display text-ink-soft tabular-nums">
                      {i + 1}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {f.nombre}
                    {f.esTuya ? ' · tú' : ''}
                  </span>
                  {f.valor !== null && (
                    <span className="font-mono text-ink-soft tabular-nums">
                      {f.valor.toLocaleString('es-MX')}
                      {lista.modo === 'rachas' ? ' días' : ' pts'}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-soft">
              Nadie ha jugado esta semana. ¡Sé la primera persona!
            </p>
          )}
        </section>
      )}

      {pasados.length > 0 && (
        <details className="rounded-lg border border-rule bg-cream px-3.5 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">
            Promociones anteriores ({pasados.length})
          </summary>
          <ul className="mt-2 grid gap-2">
            {pasados.map((c) => (
              <li key={c.codigo} className="flex items-center gap-2 text-ink-soft">
                <Icono
                  nombre={c.estado === 'CANJEADO' ? 'palomita' : 'reloj'}
                  width={16}
                  height={16}
                />
                <span className="min-w-0 flex-1">
                  {c.titulo} · <span className="font-mono">{c.codigo}</span>
                </span>
                <span className="text-xs">
                  {c.estado === 'CANJEADO' ? ETIQUETA_ESTADO.CANJEADO : ETIQUETA_ESTADO.VENCIDO}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-muted">
        Son juegos de habilidad, sin sorteos ni azar en los premios. Cada promoción se gana una vez
        por reto y periodo, es personal y se cobra en caja antes de que venza. Puedes jugar{' '}
        {a.partidasDia} {a.partidasDia === 1 ? 'partida' : 'partidas'} al día; empezar una cuenta
        aunque no la termines.
      </p>

      <NavTarjeta
        actual="/lealtad/juegos"
        premiosListos={t.premios.filter((p) => p.disponible).length}
      />
    </>
  );
}
