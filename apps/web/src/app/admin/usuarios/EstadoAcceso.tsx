import type { UsuarioPanel } from '@wl/database';

/** Etiqueta corta del estado de acceso de una cuenta. */
export function estadoAcceso(u: UsuarioPanel): { texto: string; clase: string; detalle: string } {
  if (!u.activo) {
    return {
      texto: 'Desactivada',
      clase: 'bg-rule/60 text-ink-soft',
      detalle: 'No puede entrar al panel.',
    };
  }
  if (u.tieneContrasena) {
    return {
      texto: 'Activa',
      clase: 'bg-disponible/10 text-disponible',
      detalle: 'Ya eligió su contraseña y puede entrar.',
    };
  }
  if (u.enlaceVigenteHasta) {
    return {
      texto: 'Invitación pendiente',
      clase: 'bg-ink/5 text-ink',
      detalle: 'Tiene un enlace vigente, pero todavía no elige su contraseña.',
    };
  }
  return {
    texto: 'Sin acceso',
    clase: 'bg-agotado/10 text-agotado',
    detalle: 'No tiene contraseña ni enlace vigente. Mándale uno para que pueda entrar.',
  };
}

export function ChipAcceso({ usuario }: { usuario: UsuarioPanel }) {
  const e = estadoAcceso(usuario);
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${e.clase}`}>
      {e.texto}
    </span>
  );
}
