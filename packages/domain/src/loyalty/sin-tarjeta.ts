import { normalizarFolio } from './motor';

/**
 * Reglas de «Registrar visita sin tarjeta» (regla por omisión; cada negocio la ajusta).
 *
 * Cuando el cliente no trae su QR, la caja lo identifica por celular o correo.
 * Eso abre una puerta: alguien que conozca el contacto de un cliente podría
 * sumarle visitas sin compra. Por eso, sin tarjeta a la vista se exigen dos
 * cosas que con el QR solo son deseables:
 *
 * - El **nombre** que dice la persona, para cotejarlo con el de la tarjeta.
 * - El **comprobante de compra**: foto del ticket o su folio. El folio además
 *   no puede repetirse (`ticket_key`), así que un mismo ticket no acredita
 *   dos visitas.
 */

/** Nombre que dice el cliente en el primer paso. Devuelve el error o null. */
export function validarNombreDicho(nombre: string): string | null {
  return limpiar(nombre).length < 2 ? 'Escribe el nombre del cliente.' : null;
}

/** Comprobante de compra: folio o foto del ticket, al menos uno. */
export function validarComprobanteSinTarjeta(d: {
  readonly folio: string;
  readonly fotoTicketUrl: string | null;
}): string | null {
  if (normalizarFolio(d.folio) !== '' || d.fotoTicketUrl) return null;
  return 'Sin la tarjeta del cliente se necesita el comprobante: toma foto del ticket o escribe su folio.';
}

/**
 * ¿El nombre que dijo la persona corresponde al de la tarjeta?
 *
 * Comparación suave: sin acentos ni mayúsculas, basta con que compartan una
 * palabra de tres letras o más ("Mariana López" y "mariana lopez ruiz" sí;
 * "Ana" contra "Mariana" no). Sirve para avisar a la caja, no para bloquear:
 * los nombres se capturan con prisa y con errores. Devuelve null si no hay
 * con qué comparar.
 */
export function nombresCoinciden(dicho: string, registrado: string | null): boolean | null {
  const a = palabras(dicho);
  const b = new Set(palabras(registrado ?? ''));
  if (a.length === 0 || b.size === 0) return null;
  return a.some((p) => b.has(p));
}

/**
 * Reparte el nombre dicho en el primer paso entre los tres campos del alta,
 * para que la caja solo corrija: con tres o más palabras, las dos últimas son
 * los apellidos; con dos, nombre y apellido paterno; con una, solo el nombre.
 */
export function repartirNombre(nombre: string): {
  readonly nombre: string;
  readonly apellidoPaterno: string;
  readonly apellidoMaterno: string;
} {
  const partes = limpiar(nombre).split(' ').filter(Boolean);
  if (partes.length >= 3) {
    return {
      nombre: partes.slice(0, -2).join(' '),
      apellidoPaterno: partes[partes.length - 2]!,
      apellidoMaterno: partes[partes.length - 1]!,
    };
  }
  return {
    nombre: partes[0] ?? '',
    apellidoPaterno: partes[1] ?? '',
    apellidoMaterno: '',
  };
}

function limpiar(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function palabras(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 3);
}
