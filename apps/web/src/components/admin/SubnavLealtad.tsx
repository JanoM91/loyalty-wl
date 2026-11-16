const PESTANAS = [
  { href: '/admin/lealtad', etiqueta: 'Resumen' },
  { href: '/admin/lealtad/analitica', etiqueta: 'Analítica' },
  { href: '/admin/lealtad/tarjetas', etiqueta: 'Tarjetas' },
  { href: '/admin/lealtad/pendientes', etiqueta: 'Pendientes' },
  { href: '/admin/lealtad/sucursales', etiqueta: 'Sucursales y códigos' },
  { href: '/admin/lealtad/programa', etiqueta: 'Programa' },
] as const;

/** Pestañas de la administración del programa de lealtad. */
export function SubnavLealtad({ actual, pendientes }: { actual: string; pendientes?: number }) {
  return (
    <nav aria-label="Programa de lealtad" className="-mt-3 mb-8 flex gap-1 overflow-x-auto">
      {PESTANAS.map((p) => {
        const activa = actual === p.href;
        return (
          <a
            key={p.href}
            href={p.href}
            aria-current={activa ? 'page' : undefined}
            className={`flex-none rounded-full border px-3.5 py-1.5 text-[14px] whitespace-nowrap ${activa ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {p.etiqueta}
            {p.href === '/admin/lealtad/pendientes' && pendientes ? (
              <span className="ml-1.5 rounded-full bg-agotado/15 px-1.5 py-0.5 text-[11px] font-semibold text-agotado">
                {pendientes}
              </span>
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}
