import { fechaLocal, sumarDias } from '@wl/domain';

import { prisma, negocioActual } from '../index';

/**
 * Mantenimiento del programa de lealtad: lo que corre solo, sin nadie en caja.
 *
 * **Fotos de ticket.** El aviso de privacidad promete conservarlas 90 días
 * desde la compra. Son evidencia para aclaraciones y revisiones, no un archivo
 * histórico: pasado ese plazo, una foto con folio, importe y a veces el nombre
 * de quien pagó con tarjeta solo es un riesgo. La acreditación se conserva; lo
 * que se borra es la imagen.
 */

export interface FotoVencida {
  readonly id: string;
  readonly url: string;
}

/** Fecha civil (en la zona del negocio) desde la que una foto todavía se conserva. */
export async function inicioConservacionFotos(hoy?: string): Promise<string> {
  const negocio = await negocioActual();
  return sumarDias(
    hoy ?? fechaLocal(new Date(), negocio.zonaHoraria),
    -negocio.ajustes.diasConservacionFotos,
  );
}

/**
 * Acreditaciones cuya foto ya cumplió el plazo.
 *
 * Se cuenta desde la fecha de compra, como dice el aviso, y no desde que se
 * subió la foto: un ticket de contingencia se fotografía uno o dos días
 * después y no por eso merece vivir más.
 */
export async function fotosVencidas(limite = 500, hoy?: string): Promise<FotoVencida[]> {
  const desde = await inicioConservacionFotos(hoy);
  const filas = await prisma.loyaltyAccrual.findMany({
    where: { photoUrl: { not: null }, purchaseDate: { lt: new Date(`${desde}T00:00:00Z`) } },
    select: { id: true, photoUrl: true },
    orderBy: { purchaseDate: 'asc' },
    take: limite,
  });
  return filas.map((f) => ({ id: f.id, url: f.photoUrl! }));
}

/**
 * Quita la referencia a las fotos ya borradas del almacén y deja constancia
 * en la bitácora. Se llama después de borrar los archivos: si el borrado
 * falla, la referencia sigue ahí y la siguiente corrida lo vuelve a intentar.
 */
export async function olvidarFotos(ids: readonly string[], huerfanas = 0): Promise<number> {
  if (ids.length === 0 && huerfanas === 0) return 0;
  const r =
    ids.length > 0
      ? await prisma.loyaltyAccrual.updateMany({
          where: { id: { in: [...ids] } },
          data: { photoUrl: null },
        })
      : { count: 0 };
  await prisma.auditLog.create({
    data: {
      userId: null,
      action: 'lealtad.limpieza_fotos',
      entityType: 'loyalty_accrual',
      entityId: null,
      metadata: {
        fotosBorradas: r.count,
        huerfanasBorradas: huerfanas,
        plazoDias: (await negocioActual()).ajustes.diasConservacionFotos,
      },
    },
  });
  return r.count;
}

/**
 * ¿Alguna acreditación apunta todavía a esta foto? Sirve para no borrar una
 * imagen del almacén que la base sigue usando cuando se barren huérfanas.
 */
export async function fotosEnUso(urls: readonly string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const filas = await prisma.loyaltyAccrual.findMany({
    where: { photoUrl: { in: [...urls] } },
    select: { photoUrl: true },
  });
  return new Set(filas.map((f) => f.photoUrl!));
}
