'use client';

import { useActionState } from 'react';

import { Alerta, BotonEnviar, Campo, claseEntrada } from '@/components/admin/Formulario';
import { pedirRecuperacion, type EstadoRecuperar } from '../acciones';

const INICIAL: EstadoRecuperar = { error: null, enviado: false };

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(pedirRecuperacion, INICIAL);

  if (estado.enviado) {
    return (
      <div className="space-y-4">
        <Alerta tono="ok">
          Si ese correo tiene una cuenta con el correo confirmado, te llegará un enlace en unos
          minutos. Revisa también spam o Promociones. El enlace vence en una hora.
        </Alerta>
        <p className="text-sm text-ink-soft">
          ¿No llega? Pide a administración que te genere un enlace desde{' '}
          <span className="font-medium text-ink">Usuarios</span> en el panel.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-4">
      {estado.error && <Alerta tono="error">{estado.error}</Alerta>}
      <Campo id="email" etiqueta="Correo de tu cuenta">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className={claseEntrada}
        />
      </Campo>
      <div className="[&>button]:w-full">
        <BotonEnviar texto="Mandarme un enlace" enviando="Enviando…" />
      </div>
    </form>
  );
}
