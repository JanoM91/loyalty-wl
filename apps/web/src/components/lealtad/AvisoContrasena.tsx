import { Aviso } from './Aviso';

/**
 * Sugerencia para quien todavía no crea contraseña. Desde nov 2026 la
 * contraseña es opcional (la tarjeta siempre se abre con el enlace personal o
 * desde Wallet), así que solo sale en el perfil y sin insistir.
 */
export function AvisoContrasena({ tiene }: { tiene: boolean }) {
  if (tiene) return null;
  return (
    <Aviso tono="info" titulo="Opcional: crea una contraseña" icono="candado">
      Tu enlace personal y Wallet bastan para abrir tu tarjeta. Con una contraseña también entras
      escribiendo tu correo o tu celular.{' '}
      <a href="/lealtad/perfil#contrasena" className="font-semibold underline">
        Crearla
      </a>
    </Aviso>
  );
}
