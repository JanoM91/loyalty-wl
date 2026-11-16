import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  clave: string | Buffer,
  sal: Buffer,
  longitud: number,
  opciones: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Contraseñas del panel de administración.
 *
 * **Por qué scrypt y no bcrypt.** scrypt viene en Node, sin dependencias ni
 * binarios que compilar —los paquetes nativos de bcrypt fallan a menudo en
 * los servidores de despliegue— y está diseñado para lo mismo: ser lento a
 * propósito y costoso en memoria, de modo que probar millones de contraseñas
 * salga caro incluso con hardware dedicado.
 *
 * **Por qué no se guarda la contraseña.** Nunca se almacena ni se registra.
 * Lo que se guarda es un hash con sal única por usuario, así que dos personas
 * con la misma contraseña tienen hashes distintos y una tabla precalculada no
 * sirve de nada.
 *
 * **Los parámetros van dentro del hash.** El formato incluye N, r y p. Cuando
 * dentro de unos años convenga subirlos, las contraseñas viejas seguirán
 * verificándose con los suyos y se podrán reescribir al validarlas.
 */

/** Coste de CPU y memoria. N=2^16 son unos 64 MB y ~100 ms por intento. */
const N = 65536;
const r = 8;
const p = 1;
const LONGITUD_HASH = 64;
const LONGITUD_SAL = 16;

// scrypt necesita permiso explícito para usar más memoria de la que Node
// concede por omisión (32 MB). Sin esto, N=65536 falla con "memory limit
// exceeded" en tiempo de ejecución y no al escribir el código.
const MAXMEM = 128 * N * r * 2;

export const LONGITUD_MINIMA_CONTRASENA = 10;

/**
 * Valida que la contraseña sea utilizable antes de aceptarla.
 *
 * Solo exige longitud. Las reglas de "una mayúscula, un número y un símbolo"
 * producen contraseñas peores: la gente responde con `Panaderia1!`, fácil de
 * adivinar y difícil de recordar. Una frase larga vale más.
 */
export function validarContrasena(clave: string): { ok: true } | { ok: false; motivo: string } {
  if (clave.length < LONGITUD_MINIMA_CONTRASENA) {
    return {
      ok: false,
      motivo: `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres. Una frase que recuerdes es mejor que algo corto y complicado.`,
    };
  }
  if (clave.length > 200) {
    return { ok: false, motivo: 'La contraseña es demasiado larga.' };
  }
  return { ok: true };
}

export async function hashContrasena(clave: string): Promise<string> {
  const sal = randomBytes(LONGITUD_SAL);
  const derivada = await scrypt(clave.normalize('NFKC'), sal, LONGITUD_HASH, {
    N,
    r,
    p,
    maxmem: MAXMEM,
  });
  return ['scrypt', N, r, p, sal.toString('base64'), derivada.toString('base64')].join('$');
}

/**
 * Comprueba una contraseña contra su hash.
 *
 * Devuelve `false` ante cualquier hash malformado en lugar de lanzar: un
 * registro corrupto en la base no debe tumbar la pantalla de acceso, solo
 * impedir la entrada.
 */
export async function verificarContrasena(clave: string, hashGuardado: string): Promise<boolean> {
  const partes = hashGuardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, nTexto, rTexto, pTexto, salTexto, hashTexto] = partes;
  const nGuardado = Number(nTexto);
  const rGuardado = Number(rTexto);
  const pGuardado = Number(pTexto);

  if (
    !Number.isInteger(nGuardado) ||
    !Number.isInteger(rGuardado) ||
    !Number.isInteger(pGuardado)
  ) {
    return false;
  }
  // Un N absurdo en un registro manipulado podría agotar la memoria del
  // servidor. Se acota a lo que esta aplicación llega a emitir.
  if (nGuardado > N || rGuardado > 16 || pGuardado > 4) return false;

  let esperado: Buffer;
  let derivada: Buffer;
  try {
    esperado = Buffer.from(hashTexto ?? '', 'base64');
    derivada = await scrypt(
      clave.normalize('NFKC'),
      Buffer.from(salTexto ?? '', 'base64'),
      esperado.length,
      {
        N: nGuardado,
        r: rGuardado,
        p: pGuardado,
        maxmem: MAXMEM,
      },
    );
  } catch {
    return false;
  }

  if (esperado.length === 0 || esperado.length !== derivada.length) return false;

  // Comparación en tiempo constante: un `===` se detendría en el primer byte
  // distinto, y esa diferencia medible permite reconstruir el hash byte a byte.
  return timingSafeEqual(esperado, derivada);
}
