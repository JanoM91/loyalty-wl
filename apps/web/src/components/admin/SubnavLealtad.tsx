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
    <nav
      aria-label="Programa de lealtad"
      className="-mt-2 mb-6 flex gap-1 overflow-x-auto border-b border-rule"
    >
      {PESTANAS.map((p) => {
        const activa = actual === p.href;
        return (
          <a
            key={p.href}
            href={p.href}
            aria-current={activa ? 'page' : undefined}
            className={`flex-none border-b-2 px-3 py-2 text-sm whitespace-nowrap ${activa ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
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
