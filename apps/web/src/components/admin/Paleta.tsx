'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface ComandoPaleta {
  readonly id: string;
  readonly texto: string;
  readonly grupo: string;
  /** Dirección completa a la que lleva (con el tramo del negocio). */
  readonly href?: string;
  /** Acción en la pantalla actual (enfocar, conectar…), en vez de navegar. */
  readonly run?: () => void;
  readonly claves?: string;
}

/** Sin acentos y en minúsculas, para buscar «cafe» y encontrar «café». */
function plano(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Paleta de acciones del panel: ⌘K o Ctrl+K desde cualquier pantalla.
 *
 * Busca acciones y, si se escribe algo que no es una acción, ofrece buscar un
 * cliente con ese texto. Enter ejecuta la primera, las flechas eligen y Esc
 * cierra. Al cerrar, el foco regresa al botón que la abrió.
 */
export function Paleta({
  comandos,
  buscarClientes,
  claseBoton,
  variante = 'acciones',
  etiqueta = 'Buscar cliente o acción',
  marcador = 'Sumar sello, buscar cliente, premio, cartel…',
  sugerencia = 'Prueba «sello», «premio» o «cartel».',
}: {
  comandos: readonly ComandoPaleta[];
  /** Dirección de la lista de clientes, para «Buscar cliente…». Null: sin búsqueda. */
  buscarClientes: string | null;
  claseBoton?: string;
  /**
   * «buscar»: lupa sola en el celular y barra de búsqueda en la computadora.
   * «barra»: barra de búsqueda a todo lo ancho, también en el celular.
   * Debe haber una sola paleta por pantalla: cada una escucha ⌘K.
   */
  variante?: 'acciones' | 'buscar' | 'barra';
  /** Texto del botón que la abre (variantes «buscar» y «barra»). */
  etiqueta?: string;
  /** Texto de ejemplo dentro del campo. */
  marcador?: string;
  /** Qué probar cuando no hay resultados. */
  sugerencia?: string;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const boton = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const idLista = useId();

  const cerrar = useCallback(() => {
    setAbierta(false);
    setQ('');
    setActivo(0);
    boton.current?.focus();
  }, []);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierta((a) => !a);
        setQ('');
        setActivo(0);
      }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  useEffect(() => {
    if (abierta) campo.current?.focus();
  }, [abierta]);

  const resultados = useMemo(() => {
    const t = plano(q.trim());
    const hallados = comandos.filter(
      (c) => !t || plano(`${c.texto} ${c.grupo} ${c.claves ?? ''}`).includes(t),
    );
    if (t && buscarClientes) {
      hallados.push({
        id: 'buscar-cliente',
        texto: `Buscar cliente «${q.trim()}»`,
        grupo: 'Clientes',
        href: `${buscarClientes}?q=${encodeURIComponent(q.trim())}`,
      });
    }
    return hallados;
  }, [comandos, q, buscarClientes]);

  function ejecutar(c: ComandoPaleta | undefined) {
    if (!c) return;
    setAbierta(false);
    setQ('');
    setActivo(0);
    if (c.run) c.run();
    else if (c.href) router.push(c.href);
  }

  function teclaCampo(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => Math.min(resultados.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ejecutar(resultados[activo]);
    }
  }

  return (
    <>
      {variante === 'barra' ? (
        <button
          ref={boton}
          type="button"
          onClick={() => setAbierta(true)}
          aria-haspopup="dialog"
          aria-label={etiqueta}
          className={
            claseBoton ??
            'flex min-h-[60px] w-full items-center gap-3 rounded-[18px] border-[1.5px] border-[#E8D8C6] bg-white pr-3 pl-5 text-left text-[17px] text-[#5A4F63] transition-shadow hover:shadow-[0_14px_30px_-18px_rgba(18,10,42,.55)]'
          }
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            className="flex-none text-ink"
          >
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4" />
          </svg>
          <span className="min-w-0 flex-1 truncate">{etiqueta}</span>
          <kbd className="hidden rounded-md bg-crumb px-1.5 py-0.5 font-sans text-[12px] font-semibold text-ink lg:inline">
            ⌘K
          </kbd>
        </button>
      ) : variante === 'buscar' ? (
        <button
          ref={boton}
          type="button"
          onClick={() => setAbierta(true)}
          aria-haspopup="dialog"
          aria-label={etiqueta}
          className={
            claseBoton ??
            'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-[#E8D8C6] bg-white text-ink transition-shadow hover:shadow-[0_10px_24px_-16px_rgba(6,35,28,.6)] lg:w-[320px] lg:justify-start lg:pr-2 lg:pl-3.5 lg:text-[15px] lg:text-[#5A4F63]'
          }
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4" />
          </svg>
          <span className="hidden flex-1 text-left lg:inline">{etiqueta}</span>
          <kbd className="hidden rounded-md bg-crumb px-1.5 py-0.5 font-sans text-[12px] font-semibold text-ink lg:inline">
            ⌘K
          </kbd>
        </button>
      ) : (
        <button
          ref={boton}
          type="button"
          onClick={() => setAbierta(true)}
          aria-haspopup="dialog"
          className={
            claseBoton ??
            'inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-rule bg-white/75 pr-2 pl-4 text-[14px] text-muted backdrop-blur hover:text-ink'
          }
        >
          Acciones
          <kbd className="hidden rounded-md border border-rule px-1.5 py-0.5 font-sans text-[12px] text-ink sm:inline">
            ⌘K
          </kbd>
        </button>
      )}

      {abierta && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#120A2A]/20 px-4 pt-[12vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Acciones rápidas"
            className="w-full max-w-[580px] overflow-hidden rounded-[22px] bg-white shadow-[0_30px_80px_-30px_rgba(6,35,28,.6)]"
          >
            <div className="flex items-center gap-2.5 border-b border-rule px-4">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="flex-none text-muted"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4 4" />
              </svg>
              <input
                ref={campo}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActivo(0);
                }}
                onKeyDown={teclaCampo}
                role="combobox"
                aria-expanded="true"
                aria-controls={idLista}
                aria-activedescendant={resultados[activo] ? `${idLista}-${activo}` : undefined}
                aria-label="Escribe una acción o el nombre de un cliente"
                placeholder={marcador}
                className="min-h-[58px] flex-1 border-0 bg-transparent text-[17px] text-ink outline-none"
              />
              <button
                type="button"
                onClick={cerrar}
                className="min-h-[36px] rounded-lg border border-rule px-2 text-[12px] text-muted"
              >
                Esc
              </button>
            </div>
            <ul id={idLista} role="listbox" className="grid max-h-[50vh] overflow-y-auto p-2">
              {resultados.map((c, i) => (
                <li key={c.id} id={`${idLista}-${i}`} role="option" aria-selected={i === activo}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => ejecutar(c)}
                    className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-[15px] text-ink ${i === activo ? 'bg-[#ECFFBF]' : ''}`}
                  >
                    <span>{c.texto}</span>
                    <span className="text-[12px] text-muted">{c.grupo}</span>
                  </button>
                </li>
              ))}
              {resultados.length === 0 && (
                <li className="px-3 py-3.5 text-[14px] text-muted">
                  Nada con «{q}». {sugerencia}
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
