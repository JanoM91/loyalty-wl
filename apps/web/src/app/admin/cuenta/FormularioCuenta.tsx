'use client';

import { useActionState } from 'react';

import { Alerta, BotonEnviar, Campo, claseEntrada } from '@/components/admin/Formulario';
import { cambiarMiContrasena, type EstadoCuenta } from './acciones';

const INICIAL: EstadoCuenta = { error: null, aviso: null };

export function FormularioCuenta({ email, minimo }: { email: string; minimo: number }) {
  const [estado, accion] = useActionState(cambiarMiContrasena, INICIAL);

  return (
    // La clave hace que el formulario se vacíe tras un cambio correcto.
    <form key={estado.aviso ?? 'f'} action={accion} className="max-w-md space-y-4">
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      {estado.aviso && <Alerta tono="ok">{estado.aviso}</Alerta>}
      <input type="email" name="usuario" value={email} autoComplete="username" readOnly hidden />

      <Campo id="actual" etiqueta="Contraseña actual">
        <input
          id="actual"
          name="actual"
          type="password"
          required
          autoComplete="current-password"
          className={claseEntrada}
        />
      </Campo>
      <Campo id="nueva" etiqueta="Contraseña nueva" ayuda={`Mínimo ${minimo} caracteres.`}>
        <input
          id="nueva"
          name="nueva"
          type="password"
          required
          minLength={minimo}
          autoComplete="new-password"
          className={claseEntrada}
        />
      </Campo>
      <Campo id="confirmacion" etiqueta="Repite la nueva">
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
      <BotonEnviar texto="Cambiar contraseña" enviando="Guardando…" />
    </form>
  );
}
