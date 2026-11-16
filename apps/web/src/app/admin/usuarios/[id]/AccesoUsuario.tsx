'use client';

import { useActionState } from 'react';

import { BotonEnviar } from '@/components/admin/Formulario';
import { generarEnlace, type EstadoEnlaceAdmin } from '../acciones';
import { ResultadoEntrega } from '../FormularioUsuario';

const INICIAL: EstadoEnlaceAdmin = { entrega: null };

/**
 * Generar un enlace para que la persona elija contraseña: la primera vez o
 * cuando la olvidó. Dos formularios con la misma acción, para que cada botón
 * muestre su propio «enviando».
 */
export function AccesoUsuario({
  id,
  nombre,
  email,
  tieneContrasena,
}: {
  id: string;
  nombre: string;
  email: string;
  tieneContrasena: boolean;
}) {
  const [estado, accion] = useActionState(generarEnlace, INICIAL);

  return (
    <div className="space-y-4">
      {estado.entrega && <ResultadoEntrega nombre={nombre} entrega={estado.entrega} />}

      <div className="flex flex-wrap gap-3">
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="modo" value="correo" />
          <BotonEnviar
            texto={
              tieneContrasena
                ? 'Mandar enlace para nueva contraseña'
                : 'Mandar invitación por correo'
            }
            enviando="Enviando…"
          />
        </form>
        <form action={accion}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="modo" value="enlace" />
          <BotonEnviar texto="Crear enlace para compartir" enviando="Creando…" secundario />
        </form>
      </div>
      <p className="text-xs text-muted">
        El correo se manda a <span className="break-all">{email}</span>. Cada enlace nuevo anula el
        anterior.{' '}
        {tieneContrasena &&
          'Su contraseña actual sigue sirviendo hasta que elija la nueva; en ese momento se cierran sus sesiones abiertas.'}
      </p>
    </div>
  );
}
