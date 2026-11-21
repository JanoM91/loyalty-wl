'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { guardarPrograma, programaVigente } from '@wl/database';
import { clavePremioDesdeNombre } from '@wl/domain';

import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { actualizarTodosLosPases } from '@/lib/wallet/avisar';

/**
 * Acciones del mapa del club.
 *
 * `guardarPremio` cambia el premio y los sellos desde la tarjeta «Premio» del
 * mapa. Solo para el programa sencillo (un premio, un sello por visita), que
 * es el de todos los clubes del asistente; uno con varios premios o por
 * importe se edita en la pantalla completa del programa. Igual que esa
 * pantalla, guarda una versión nueva: lo ya ganado conserva su premio.
 */

export interface EstadoPremio {
  readonly ok: boolean;
  readonly mensaje: string | null;
}

export async function guardarPremio(_previo: EstadoPremio, form: FormData): Promise<EstadoPremio> {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const actual = await programaVigente();
  const hito = actual.hitos[0];
  if (actual.modalidad !== 'VISITA' || actual.hitos.length !== 1 || !hito) {
    return {
      ok: false,
      mensaje: 'Tu programa tiene varios premios: cámbialo en la pantalla del programa.',
    };
  }

  const nombre = String(form.get('premio') ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const sellos = Number(form.get('sellos'));
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, mensaje: 'Escribe el premio.' };
  if (!Number.isInteger(sellos) || sellos < 3 || sellos > 12) {
    return { ok: false, mensaje: 'La tarjeta lleva entre 3 y 12 sellos.' };
  }
  if (nombre === hito.nombre && sellos === actual.posiciones) {
    return { ok: true, mensaje: 'Sin cambios.' };
  }

  const r = await guardarPrograma(
    {
      posiciones: sellos,
      modalidad: actual.modalidad,
      tramos: actual.tramos,
      ventanaContingenciaDias: actual.ventanaContingenciaDias,
      hitos: [
        {
          posicion: sellos,
          // Mismo nombre, misma clave; nombre nuevo, premio nuevo.
          premio: nombre === hito.nombre ? hito.premio : clavePremioDesdeNombre(nombre),
          nombre,
          incluye: hito.incluye,
        },
      ],
    },
    { usuarioId: sesion.userId, nota: 'Cambio desde el mapa del club' },
  );
  if (!r.ok) return { ok: false, mensaje: r.problemas.join(' ') };

  revalidatePath('/admin', 'layout');
  revalidatePath('/lealtad', 'layout');
  // Los pases de Wallet muestran el premio: se les avisa sin detener la respuesta.
  after(() => actualizarTodosLosPases());
  return { ok: true, mensaje: 'Listo: tus clientes ya ven el premio nuevo.' };
}
