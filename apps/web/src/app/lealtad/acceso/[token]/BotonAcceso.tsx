'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import {
  AYUDA_CONTRASENA_NUEVA,
  CampoContrasena,
  UsuarioParaGestor,
} from '@/components/lealtad/CampoContrasena';
import { entrarConEnlace, type EstadoEnlace } from '../../acciones';

const INICIAL: EstadoEnlace = { error: null };

function Boton({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[56px] w-full items-center justify-center rounded-sm bg-ink px-5 text-base font-semibold text-cream hover:bg-ink-soft disabled:opacity-50"
    >
      {pending ? 'Abriendo…' : texto}
    </button>
  );
}

/**
 * Formulario del enlace de acceso.
 *
 * - OBLIGATORIA: la contraseña nueva va con el botón; sin ella no se abre.
 * - OPCIONAL: puede abrir tal cual o crear (o cambiar) su contraseña aquí
 *   mismo. Desde nov 2026 es lo normal: la contraseña ya no es obligatoria.
 * - NO: arranque de la app instalada (no pasa por esta pantalla).
 */
export function BotonAcceso({
  token,
  contrasena,
  usuario,
}: {
  token: string;
  contrasena: 'OBLIGATORIA' | 'OPCIONAL' | 'NO';
  usuario: string | null;
}) {
  const [estado, accion] = useActionState(entrarConEnlace, INICIAL);
  const [nueva, setNueva] = useState(contrasena === 'OBLIGATORIA');

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      {nueva && <UsuarioParaGestor valor={usuario} />}
      {nueva && (
        <CampoContrasena
          name="clave"
          etiqueta={contrasena === 'OBLIGATORIA' ? 'Tu contraseña' : 'Contraseña nueva'}
          autoComplete="new-password"
          ayuda={AYUDA_CONTRASENA_NUEVA}
          autoFocus
        />
      )}
      {estado.error && (
        <Aviso
          tono="error"
          titulo={estado.contrasena ? 'Revisa tu contraseña' : 'No se pudo abrir'}
        >
          {estado.error}{' '}
          {!estado.contrasena && (
            <a href="/lealtad/recuperar" className="font-semibold underline">
              Pedir otro enlace
            </a>
          )}
        </Aviso>
      )}
      <Boton texto={nueva ? 'Guardar y abrir mi tarjeta' : 'Abrir mi tarjeta'} />
      {contrasena === 'OPCIONAL' && !nueva && (
        <button
          type="button"
          onClick={() => setNueva(true)}
          className="text-sm text-crust-dark underline underline-offset-4"
        >
          Crear o cambiar mi contraseña (opcional)
        </button>
      )}
    </form>
  );
}
