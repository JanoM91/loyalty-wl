import type { ReactNode } from 'react';

import type { Sesion } from '@/lib/admin/sesion';
import { salir } from '@/app/admin/entrar/acciones';
import { LogoMarca } from '@/components/Marca';

import { AvisoClub } from './AvisoClub';

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
  { href: '/admin/lealtad', etiqueta: 'Programa', roles: DIRECCION },
  { href: '/admin/marca', etiqueta: 'Marca', roles: ['ADMIN', 'DUENO'] },
  { href: '/admin/sucursales', etiqueta: 'Sucursales', roles: DIRECCION },
  { href: '/admin/usuarios', etiqueta: 'Usuarios', roles: ['ADMIN', 'DUENO'] },
  { href: '/admin/ayuda', etiqueta: 'Ayuda', roles: ['ADMIN', 'DUENO', 'GERENTE', 'SUCURSAL'] },
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
    <div className="mx-auto max-w-5xl px-5 pb-16">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 py-5">
        <a href="/admin" className="text-ink">
          <LogoMarca sobre="claro" className="h-8 text-[19px]" />
        </a>

        <nav aria-label="Secciones del panel" className="order-3 w-full md:order-none md:w-auto">
          <ul className="flex gap-1 overflow-x-auto">
            {visibles.map((s) => {
              const esActiva = s.href === activa;
              return (
                <li key={s.href} className="flex-none">
                  <a
                    href={s.href}
                    aria-current={esActiva ? 'page' : undefined}
                    className={[
                      'block rounded-full px-4 py-2 text-[15px] whitespace-nowrap',
                      esActiva ? 'bg-ink text-cream' : 'text-muted hover:text-ink',
                    ].join(' ')}
                  >
                    {s.etiqueta}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-4 text-[13px] text-muted">
          <a href="/admin/cuenta" title="Mi cuenta: cambiar contraseña" className="hover:text-ink">
            {sesion.nombre || 'Mi cuenta'}
          </a>
          {/* Cerrar sesión cambia el estado del servidor: va en un formulario y
              no en un enlace, que cualquier precarga podría disparar. */}
          <form action={salir}>
            <button type="submit" className="hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      </header>

      <AvisoClub sesion={sesion} />

      <main id="contenido" className="mt-8 min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[clamp(2rem,5vw,2.75rem)] text-ink">{titulo}</h1>
            {descripcion && (
              <p className="mt-2 max-w-prose text-[15px] text-muted">{descripcion}</p>
            )}
          </div>
          {acciones}
        </div>

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
