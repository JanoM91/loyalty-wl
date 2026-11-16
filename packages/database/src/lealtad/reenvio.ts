import { enmascararContacto, HORAS_ENLACE_REENVIO, type CanalReenvio } from '@wl/domain';

import { prisma } from '../index';
import { crearEnlaceAcceso, MINUTOS_ENLACE_PANEL } from './verificacion';

/**
 * «Volver a mandar el enlace» desde la caja.
 *
 * Para quien tiene tarjeta pero no la tiene abierta en su celular: no abrió a
 * tiempo el enlace de bienvenida, cambió de celular o cerró sesión. La caja
 * lo manda al contacto **registrado** de la tarjeta, nunca a uno que se
 * escriba en pantalla:
 *
 * - **WhatsApp** (3 días): al celular de la tarjeta. Al abrirlo, ese celular
 *   queda verificado (y puede canjear), igual que la bienvenida por WhatsApp.
 * - **Correo** (3 días): al correo de la tarjeta. Al abrirlo, el correo queda
 *   verificado.
 * - **Pantalla** (15 min): QR para escanear ahí mismo. No verifica nada.
 *
 * Cuenta para el tope de enlaces por tarjeta y hora (`crearEnlaceAcceso`) y
 * queda en bitácora con quién lo mandó y desde qué sucursal. Si la tarjeta
 * todavía no tiene contraseña, al abrirlo la crea.
 */

export interface AccesoTarjetaCaja {
  /**
   * Ya abrió su tarjeta en un celular alguna vez: creó contraseña, abrió un
   * enlace o tiene una sesión. Si no, la caja le sugiere mandarle el enlace.
   */
  readonly abrioTarjeta: boolean;
  readonly tieneContrasena: boolean;
}

/** ¿Esta tarjeta ya se abrió en algún celular? Para el aviso de la caja. */
export async function accesoTarjetaCaja(codigo: string): Promise<AccesoTarjetaCaja | null> {
  const t = await prisma.loyaltyCard.findFirst({
    where: { publicCode: codigo },
    select: {
      id: true,
      isActive: true,
      passwordHash: true,
      _count: { select: { sessions: true } },
    },
  });
  if (!t || !t.isActive) return null;
  const tieneContrasena = t.passwordHash !== null;
  if (tieneContrasena || t._count.sessions > 0) return { abrioTarjeta: true, tieneContrasena };

  // Las sesiones se borran al cerrar sesión; los enlaces usados se quedan.
  const usado = await prisma.loyaltyCode.findFirst({
    where: {
      cardId: t.id,
      purpose: { in: ['ACCESO', 'ACCESO_APP'] },
      consumedAt: { not: null },
    },
    select: { id: true },
  });
  return { abrioTarjeta: usado !== null, tieneContrasena };
}

export type ResultadoReenvio =
  | {
      readonly ok: true;
      readonly canal: CanalReenvio;
      readonly cardId: string;
      readonly token: string;
      readonly expira: Date;
      readonly minutos: number;
      readonly codigo: string;
      readonly nombre: string | null;
      readonly estampas: number;
      readonly tieneContrasena: boolean;
      /** Celular registrado (10 dígitos), solo por WhatsApp: a él va el mensaje. */
      readonly celular: string | null;
      /** Correo registrado, solo por correo: a él va el enlace. */
      readonly correo: string | null;
      /** Destino enmascarado, para confirmarlo con la persona. */
      readonly contacto: string;
    }
  | { readonly ok: false; readonly error: string };

export async function reenviarAccesoTarjeta(d: {
  readonly codigo: string;
  readonly canal: CanalReenvio;
  readonly usuarioId: string;
  readonly sucursalId: string | null;
}): Promise<ResultadoReenvio> {
  const t = await prisma.loyaltyCard.findFirst({
    where: { publicCode: d.codigo },
    select: {
      id: true,
      publicCode: true,
      isActive: true,
      name: true,
      email: true,
      phone: true,
      stamps: true,
      passwordHash: true,
    },
  });
  if (!t) return { ok: false, error: 'No encontramos esa tarjeta.' };
  if (!t.isActive) return { ok: false, error: 'Esa tarjeta está desactivada.' };
  if (d.canal === 'WHATSAPP' && !t.phone) {
    return { ok: false, error: 'La tarjeta no tiene celular registrado. Usa el correo o el QR.' };
  }
  if (d.canal === 'CORREO' && !t.email) {
    return { ok: false, error: 'La tarjeta no tiene correo registrado. Usa WhatsApp o el QR.' };
  }

  const celular = d.canal === 'WHATSAPP' ? t.phone : null;
  const correo = d.canal === 'CORREO' ? t.email : null;
  const minutos = d.canal === 'PANTALLA' ? MINUTOS_ENLACE_PANEL : HORAS_ENLACE_REENVIO * 60;

  // Por correo, el enlace lleva el correo (al abrirlo lo verifica); por
  // WhatsApp, el celular (lo verifica); en pantalla, ninguno.
  const enlace = await crearEnlaceAcceso(t.id, correo ?? '', minutos, { celular });
  if (!enlace) {
    return {
      ok: false,
      error: 'Ya se generaron varios enlaces para esta tarjeta en la última hora. Espera un rato.',
    };
  }

  const contacto = enmascararContacto(celular ?? correo ?? t.phone ?? t.email);
  await prisma.auditLog.create({
    data: {
      userId: d.usuarioId,
      action: 'lealtad.enlace_reenviado',
      entityType: 'loyalty_card',
      entityId: t.id,
      metadata: {
        codigo: t.publicCode,
        canal: d.canal,
        contacto,
        sucursalId: d.sucursalId,
        vence: enlace.expira.toISOString(),
      },
    },
  });

  return {
    ok: true,
    canal: d.canal,
    cardId: t.id,
    token: enlace.token,
    expira: enlace.expira,
    minutos,
    codigo: t.publicCode,
    nombre: t.name,
    estampas: t.stamps,
    tieneContrasena: t.passwordHash !== null,
    celular,
    correo,
    contacto,
  };
}
