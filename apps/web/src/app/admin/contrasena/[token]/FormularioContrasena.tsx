'use client';

import { useActionState } from 'react';

import { Alerta, BotonEnviar, Campo, claseEntrada } from '@/components/admin/Formulario';
import { fijarContrasena, type EstadoContrasena } from '../../entrar/acciones';

const INICIAL: EstadoContrasena = { error: null };

export function FormularioContrasena({
  token,
  email,
  minimo,
}: {
  token: string;
  email: string;
  minimo: number;
}) {
  const [estado, accion] = useActionState(fijarContrasena, INICIAL);

  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      <input type="hidden" name="token" value={token} />
      {/* El gestor de contraseñas del navegador necesita saber a qué cuenta
          corresponde la contraseña nueva para guardarla bien. */}
      <input type="email" name="usuario" value={email} autoComplete="username" readOnly hidden />

      <Campo
        id="clave"
        etiqueta="Contraseña nueva"
        ayuda={`Mínimo ${minimo} caracteres. Una frase que recuerdes es mejor que algo corto y complicado.`}
      >
        <input
          id="clave"
          name="clave"
          type="password"
          required
          minLength={minimo}
          autoComplete="new-password"
          autoFocus
          className={claseEntrada}
        />
      </Campo>
      <Campo id="confirmacion" etiqueta="Repítela">
        <input
          id="confirmacion"
          name="confirmacion"
          type="password"
          required
          minLength={minimo}
          autoComplete="new-password"
          className={claseEntrada}
        />
      </Campo>
      <div className="[&>button]:w-full">
        <BotonEnviar texto="Guardar y entrar" enviando="Guardando…" />
      </div>
    </form>
  );
}
