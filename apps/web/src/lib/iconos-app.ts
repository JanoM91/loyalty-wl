import type { Negocio } from '@wl/database';

import { huellaDeDiseno } from '@/lib/wallet/imagenes';
import { marcaDeImagen } from '@/lib/wallet/negocio';

/** Huella de la marca: cambia la dirección de los íconos cuando cambia la marca. */
export function huellaDeMarca(negocio: Negocio): string {
  return huellaDeDiseno(marcaDeImagen(negocio), { posiciones: 0, hitos: [] });
}

/**
 * Direcciones de los íconos de pantalla de inicio de un negocio (ver
 * `app/api/icono/[archivo]/route.ts`). `base` es el tramo del negocio en la
 * instalación compartida (`/cafe`) o vacío.
 */
export function iconosDeApp(negocio: Negocio, base: string) {
  const v = huellaDeMarca(negocio);
  const ruta = (lado: number) => `${base}/api/icono/icono-${lado}.png?v=${v}`;
  return { apple: ruta(180), chico: ruta(192), grande: ruta(512) };
}
