import type { Prisma } from '@prisma/client';

import { transaccion } from './index';
import {
  PLANTILLAS,
  leerMarca,
  negocioActual,
  type ColoresMarca,
  type MarcaNegocio,
  type PlantillaMarca,
} from './negocio';

/**
 * El negocio edita su propia marca: nombre, plantilla, colores, frase y
 * contacto. La base solo deja cambiar la fila del negocio en curso
 * (migración `marca_editable`).
 */

export interface CambiosMarca {
  readonly nombre: string;
  readonly plantilla: string;
  readonly frase: string;
  readonly colores: Record<keyof ColoresMarca, string>;
  readonly correo: string;
  readonly whatsapp: string;
  readonly sitio: string;
  readonly instagram: string;
  readonly razonSocial: string;
  readonly domicilio: string;
  readonly correoPrivacidad: string;
}

export type ResultadoMarca =
  | { readonly ok: true; readonly marca: MarcaNegocio; readonly avisos: readonly string[] }
  | { readonly ok: false; readonly error: string };

const COLOR = /^#[0-9a-f]{6}$/i;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Luminancia relativa (WCAG 2.1) de un color #rrggbb. */
function luminancia(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Contraste WCAG entre dos colores: de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Lo mínimo para que la tarjeta se pueda leer. El texto necesita 4.5:1; el
 * acento es decorativo (sellos, íconos) y con 3:1 basta.
 */
export function revisarColores(c: ColoresMarca): { errores: string[]; avisos: string[] } {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (contraste(c.sobreFondo, c.fondo) < 4.5)
    errores.push(
      'El texto de la tarjeta no se lee sobre su fondo. Elige colores con más contraste.',
    );
  if (contraste(c.tinta, c.papel) < 4.5)
    errores.push(
      'El texto no se lee sobre el fondo de la página. Elige colores con más contraste.',
    );
  if (contraste(c.acento, c.fondo) < 3)
    avisos.push(
      'El acento se distingue poco sobre el fondo de la tarjeta: los sellos se verán tenues.',
    );
  return { errores, avisos };
}

const limpio = (v: string, max: number): string | null => {
  const t = v.trim().replace(/\s+/g, ' ');
  return t === '' ? null : t.slice(0, max);
};

export async function guardarMarca(
  d: CambiosMarca,
  actor: { readonly userId: string },
): Promise<ResultadoMarca> {
  const negocio = await negocioActual();

  const nombre = limpio(d.nombre, 160);
  if (!nombre || nombre.length < 2) return { ok: false, error: 'Escribe el nombre del negocio.' };
  if (!(PLANTILLAS as readonly string[]).includes(d.plantilla))
    return { ok: false, error: 'Elige un diseño.' };

  const colores = {} as Record<keyof ColoresMarca, string>;
  for (const k of ['fondo', 'sobreFondo', 'acento', 'papel', 'tinta'] as const) {
    const v = d.colores[k]?.trim() ?? '';
    if (!COLOR.test(v)) return { ok: false, error: 'Hay un color que no es válido.' };
    colores[k] = v.toLowerCase();
  }
  const { errores, avisos } = revisarColores(colores);
  if (errores[0]) return { ok: false, error: errores[0] };

  for (const correo of [d.correo, d.correoPrivacidad]) {
    if (correo.trim() !== '' && !CORREO.test(correo.trim()))
      return { ok: false, error: 'Revisa los correos: uno no tiene forma de correo.' };
  }
  const digitos = d.whatsapp.replace(/\D/g, '');
  if (digitos !== '' && digitos.length !== 10)
    return { ok: false, error: 'El WhatsApp debe tener diez dígitos.' };
  const sitio = limpio(d.sitio, 200);
  if (sitio && !/^https:\/\/[^\s]+$/.test(sitio))
    return { ok: false, error: 'El sitio debe empezar por https://' };

  // Lo que el panel no edita (logotipos, Facebook) se conserva como está.
  const marca: MarcaNegocio = {
    ...negocio.marca,
    plantilla: d.plantilla as PlantillaMarca,
    frase: limpio(d.frase, 80) ?? '',
    colores,
    contacto: {
      correo: limpio(d.correo, 160)?.toLowerCase() ?? null,
      whatsapp: digitos ? `52${digitos}` : null,
      sitio,
    },
    redes: {
      ...negocio.marca.redes,
      instagram: limpio(d.instagram, 60)?.replace(/^@/, '') ?? null,
    },
    legal: {
      razonSocial: limpio(d.razonSocial, 200),
      domicilio: limpio(d.domicilio, 300),
      correoPrivacidad: limpio(d.correoPrivacidad, 160)?.toLowerCase() ?? null,
    },
  };

  await transaccion(async (tx) => {
    await tx.tenant.update({
      where: { id: negocio.id },
      data: { name: nombre, brand: marca as unknown as Prisma.InputJsonValue },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.userId,
        action: 'marca.guardar',
        entityType: 'tenant',
        entityId: negocio.id,
        metadata: { plantilla: marca.plantilla, colores: { ...marca.colores } },
      },
    });
  });
  return { ok: true, marca: leerMarca(marca), avisos };
}
