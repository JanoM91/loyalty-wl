import type { ReactNode } from 'react';

import type { Sesion } from '@/lib/admin/sesion';
import { salir } from '@/app/admin/entrar/acciones';
import { LogoMarca } from '@/components/Marca';

/**
 * Navegación del panel.
 *
 * Cada entrada declara qué roles la ven. Ocultar lo que alguien no puede usar
 * evita que descubra un botón para toparse con un "no tienes permiso"; el
 * permiso de verdad lo comprueba cada página, no este menú.
 */
const DIRECCION = ['ADMIN', 'DUENO', 'GERENTE'] as const;

const SECCIONES = [
  {
    href: '/admin/lealtad/caja',
    etiqueta: 'Caja',
    roles: ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'],
  },
  { href: '/admin/lealtad', etiqueta: 'Programa de lealtad', roles: DIRECCION },
  { href: '/admin/sucursales', etiqueta: 'Sucursales', roles: DIRECCION },
  { href: '/admin/usuarios', etiqueta: 'Usuarios', roles: ['ADMIN', 'DUENO'] },
] as const;

export function MarcoPanel({
  sesion,
  actual,
  titulo,
  descripcion,
  acciones,
  children,
}: {
  sesion: Sesion;
  /** Ruta de la sección activa, para resaltarla. */
  actual: string;
  titulo: string;
  descripcion?: string;
  /** Botones de la esquina, como "Nuevo producto". */
  acciones?: ReactNode;
  children: ReactNode;
}) {
  const visibles = SECCIONES.filter((s) => (s.roles as readonly string[]).includes(sesion.rol));

  // La sección activa es la de ruta más larga que coincide: "/admin/lealtad/caja"
  // también empieza por "/admin/lealtad", y solo una debe quedar marcada.
  const activa =
    [...visibles]
      .filter((s) => actual.startsWith(s.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <div>
          <a href="/admin" className="inline-flex items-center gap-2 align-middle">
            <LogoMarca sobre="claro" className="h-9 text-xl text-ink" />
            <span className="text-xs text-muted">panel</span>
          </a>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted">
          <a
            href="/admin/cuenta"
            title="Mi cuenta: cambiar contraseña"
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            {sesion.nombre} · {sesion.rol.toLowerCase()}
          </a>
          {/* Cerrar sesión es una acción que cambia el estado del servidor, así
              que va en un formulario y no en un enlace: un enlace lo podría
              disparar cualquier cosa que precargue la página. */}
          <form action={salir}>
            <button type="submit" className="underline underline-offset-4 hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="mt-6 gap-8 md:flex">
        <nav aria-label="Secciones del panel" className="md:w-48 md:flex-none">
          <ul className="flex gap-1 overflow-x-auto md:block md:space-y-0.5 md:overflow-visible">
            {visibles.map((s) => {
              const esActiva = s.href === activa;
              return (
                <li key={s.href} className="flex-none">
                  <a
                    href={s.href}
                    aria-current={esActiva ? 'page' : undefined}
                    className={[
                      'block rounded-sm px-3 py-2 text-sm whitespace-nowrap',
                      esActiva
                        ? 'bg-ink text-cream'
                        : 'text-ink-soft hover:bg-cream hover:text-ink',
                    ].join(' ')}
                  >
                    {s.etiqueta}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <main id="contenido" className="mt-6 min-w-0 flex-1 md:mt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl text-ink">{titulo}</h1>
              {descripcion && (
                <p className="mt-1 max-w-prose text-sm text-ink-soft">{descripcion}</p>
              )}
            </div>
            {acciones}
          </div>

          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
