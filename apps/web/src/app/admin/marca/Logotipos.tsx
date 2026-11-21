'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ChangeEvent } from 'react';
import type { MarcaNegocio, TipoLogo } from '@wl/database';
import type { ColoresMarca } from '@wl/domain';

import {
  ImagenIlegible,
  prepararImagen,
  prepararLogo,
  prepararSelloPropio,
} from '@/lib/logo-en-navegador';

import { cambiarLogotipo, quitarLogotipo, subirLogo, usarColoresDelLogo } from './acciones';

const NO_SE_LEYO =
  'No pudimos leer esa imagen. Prueba con una captura de pantalla, un PNG o un JPG.';
const mensaje = (e: unknown) => (e instanceof ImagenIlegible ? e.message : NO_SE_LEYO);

const BOTON =
  'inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-full px-6 text-[15px] font-semibold';

/** Botón que abre el selector de imágenes del celular y devuelve la elegida. */
function ElegirImagen({
  id,
  texto,
  ocupado,
  principal = false,
  alElegir,
}: {
  id: string;
  texto: string;
  ocupado: boolean;
  principal?: boolean;
  alElegir: (archivo: File) => void;
}) {
  return (
    <>
      <label
        htmlFor={id}
        aria-disabled={ocupado}
        className={`${BOTON} ${principal ? 'bg-ink text-cream' : 'border border-ink text-ink'} ${ocupado ? 'pointer-events-none opacity-50' : ''}`}
      >
        {texto}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={ocupado}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) alElegir(archivo);
        }}
      />
    </>
  );
}

/** Una imagen avanzada: logotipo para la tarjeta o Sello propio. */
function ImagenAvanzada({
  tipo,
  nombre,
  nota,
  url,
  activo,
}: {
  tipo: Exclude<TipoLogo, 'logoUrl'>;
  nombre: string;
  nota: string;
  url: string | null;
  activo: boolean;
}) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [estado, setEstado] = useState<string | null>(null);

  const subir = (archivo: File) =>
    iniciar(async () => {
      setEstado('Preparando…');
      try {
        const listo =
          tipo === 'iconoUrl'
            ? await prepararSelloPropio(archivo)
            : (await prepararImagen(archivo)).blob;
        setEstado('Subiendo…');
        const datos = new FormData();
        datos.set('tipo', tipo);
        datos.set('archivo', listo, listo.type === 'image/png' ? 'imagen.png' : 'imagen.jpg');
        const r = await subirLogo(datos);
        setEstado(r.ok ? 'Listo.' : r.error);
        if (r.ok) router.refresh();
      } catch (e) {
        setEstado(mensaje(e));
      }
    });

  const quitar = () =>
    iniciar(async () => {
      const datos = new FormData();
      datos.set('tipo', tipo);
      datos.set('quitar', '1');
      const r = await subirLogo(datos);
      setEstado(r.ok ? null : r.error);
      if (r.ok) router.refresh();
    });

  return (
    <div className="grid gap-3 border-t border-rule pt-4">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-28 flex-none place-items-center rounded-md bg-ink p-2">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[12px] text-cream/60">Sin imagen</span>
          )}
        </span>
        <span className="text-[14px] text-muted">
          <b className="block text-[15px] font-semibold text-ink">{nombre}</b>
          {nota}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ElegirImagen
          id={`imagen-${tipo}`}
          texto={url ? 'Cambiar' : 'Subir'}
          ocupado={ocupado || !activo}
          alElegir={subir}
        />
        {url && (
          <button
            type="button"
            onClick={quitar}
            disabled={ocupado}
            className="min-h-[44px] px-2 text-[14px] text-muted underline underline-offset-4 hover:text-ink"
          >
            Quitar
          </button>
        )}
        {estado && (
          <span role="status" className="text-[14px] text-ink">
            {estado}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * El logotipo del club, arriba de todo en «Tu marca». Se elige una imagen
 * (también una foto del celular), se prepara en el navegador y se sube sola;
 * de ella sale el Sello y, si el dueño quiere, los colores de su tarjeta.
 */
export function Logotipos({ marca, activo }: { marca: MarcaNegocio; activo: boolean }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [estado, setEstado] = useState<{ texto: string; error: boolean } | null>(null);
  const [sugeridos, setSugeridos] = useState<ColoresMarca | null>(null);

  const cambiar = (archivo: File) =>
    iniciar(async () => {
      setSugeridos(null);
      setEstado({ texto: 'Preparando tu logotipo…', error: false });
      try {
        const p = await prepararLogo(archivo);
        setEstado({ texto: 'Subiendo…', error: false });
        const datos = new FormData();
        datos.set('logo', p.logo, p.logo.type === 'image/png' ? 'logo.png' : 'logo.jpg');
        datos.set('sello', p.sello, 'sello.png');
        const r = await cambiarLogotipo(datos);
        if (!r.ok) {
          setEstado({ texto: r.error ?? 'No se pudo guardar.', error: true });
          return;
        }
        const distintos =
          p.colores &&
          (p.colores.fondo !== marca.colores.fondo || p.colores.acento !== marca.colores.acento);
        setSugeridos(distintos ? p.colores : null);
        setEstado({ texto: 'Listo: tu logotipo ya está en tu tarjeta y tu panel.', error: false });
        router.refresh();
      } catch (e) {
        setEstado({ texto: mensaje(e), error: true });
      }
    });

  const quitar = () =>
    iniciar(async () => {
      const r = await quitarLogotipo();
      setSugeridos(null);
      setEstado(r.ok ? null : { texto: r.error ?? 'No se pudo quitar.', error: true });
      if (r.ok) router.refresh();
    });

  const aplicarColores = () =>
    iniciar(async () => {
      if (!sugeridos) return;
      const datos = new FormData();
      datos.set('colores', JSON.stringify(sugeridos));
      const r = await usarColoresDelLogo(datos);
      if (r.ok) {
        setSugeridos(null);
        setEstado({ texto: 'Tu tarjeta ya lleva los colores de tu logotipo.', error: false });
        router.refresh();
      } else setEstado({ texto: r.error ?? 'No se pudieron aplicar.', error: true });
    });

  return (
    <section id="logotipo" className="grid max-w-3xl scroll-mt-6 gap-4">
      <div className="grid gap-1">
        <h2 className="text-xl text-ink">Tu logotipo</h2>
        <p className="max-w-prose text-[14px] text-muted">
          {activo
            ? 'Una foto o captura sirve: la ajustamos sola. Sale en tu tarjeta, tu panel y tu cartel, y de él hacemos el Sello de cada visita.'
            : 'La subida de imágenes todavía no está activa en esta instalación. Mientras tanto, tu nombre se escribe con la tipografía del diseño.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-rule bg-cream p-4">
        <span className="grid h-20 w-36 flex-none place-items-center rounded-md border border-rule bg-white p-2">
          {marca.logoUrl ? (
            <img src={marca.logoUrl} alt="Tu logotipo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[13px] text-muted">Sin logotipo</span>
          )}
        </span>
        {marca.iconoUrl && (
          <span
            className="grid h-20 w-20 flex-none place-items-center rounded-full"
            style={{ background: marca.colores.acento }}
            title="Así se ve en cada sello"
          >
            <img src={marca.iconoUrl} alt="Tu Sello" className="size-[64%] object-contain" />
          </span>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ElegirImagen
            id="imagen-logo"
            texto={marca.logoUrl ? 'Cambiar logotipo' : 'Subir mi logotipo'}
            ocupado={ocupado || !activo}
            principal
            alElegir={cambiar}
          />
          {marca.logoUrl && (
            <button
              type="button"
              onClick={quitar}
              disabled={ocupado}
              className="min-h-[44px] px-2 text-[14px] text-muted underline underline-offset-4 hover:text-ink"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      {estado && (
        <p
          role={estado.error ? 'alert' : 'status'}
          className={`border-l-[3px] px-3 py-2 text-[15px] text-ink ${estado.error ? 'border-danger' : 'border-disponible'}`}
        >
          {estado.texto}
        </p>
      )}

      {sugeridos && (
        <div className="grid gap-3 rounded-lg border border-rule bg-cream p-4 sm:flex sm:items-center">
          <span className="text-[15px] text-ink sm:order-2 sm:flex-1">
            ¿Usamos los colores de tu logotipo en tu tarjeta?
          </span>
          <span
            className="flex h-12 w-24 items-center justify-center gap-1.5 rounded-md sm:order-1"
            style={{ background: sugeridos.fondo }}
            aria-hidden="true"
          >
            <span className="h-4 w-4 rounded-full" style={{ background: sugeridos.acento }} />
            <span className="h-4 w-4 rounded-full" style={{ background: sugeridos.acento }} />
            <span
              className="h-4 w-4 rounded-full border-2"
              style={{ borderColor: sugeridos.sobreFondo }}
            />
          </span>
          <button
            type="button"
            onClick={aplicarColores}
            disabled={ocupado}
            className={`${BOTON} justify-self-start bg-ink text-cream disabled:opacity-50 sm:order-3`}
          >
            Usar estos colores
          </button>
        </div>
      )}

      <details className="rounded-lg border border-rule px-4 py-3">
        <summary className="min-h-[32px] cursor-pointer text-[15px] font-semibold text-ink">
          Más opciones: logotipo para la tarjeta y Sello propio
        </summary>
        <div className="mt-3 grid gap-4">
          <ImagenAvanzada
            tipo="logoClaroUrl"
            nombre="Logotipo para la tarjeta"
            nota="Una versión clara de tu logo, para que se lea sobre el color de tu tarjeta."
            url={marca.logoClaroUrl}
            activo={activo}
          />
          <ImagenAvanzada
            tipo="iconoUrl"
            nombre="Sello"
            nota="Cuadrado. Va en cada sello ganado y en el ícono de la app. Si no subes uno, lo hacemos de tu logotipo."
            url={marca.iconoUrl}
            activo={activo}
          />
        </div>
      </details>
    </section>
  );
}
