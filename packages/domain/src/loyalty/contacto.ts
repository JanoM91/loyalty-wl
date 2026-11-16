/**
 * Datos de contacto y código de la tarjeta de lealtad.
 *
 * Todo lo que entra por un formulario pasa por aquí antes de guardarse o de
 * buscarse: si "Ana@Correo.mx " y "ana@correo.mx" se guardaran distinto, una
 * misma persona tendría dos tarjetas y nadie sabría cuál vale.
 */

/**
 * Celular mexicano a diez dígitos, o null si no es uno.
 *
 * Acepta cómo lo escribe la gente: "228 818 5964", "(228) 818-5964",
 * "+52 228 818 5964" o con el viejo 044/045.
 */
export function normalizarCelular(valor: string): string | null {
  let digitos = valor.replace(/\D/g, '');
  if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2);
  if (digitos.length === 13 && digitos.startsWith('521')) digitos = digitos.slice(3);
  if (digitos.length === 13 && (digitos.startsWith('044') || digitos.startsWith('045'))) {
    digitos = digitos.slice(3);
  }
  return /^[1-9]\d{9}$/.test(digitos) ? digitos : null;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Correo en minúsculas y sin espacios, o null si no parece un correo. */
export function normalizarCorreo(valor: string): string | null {
  const limpio = valor.trim().toLowerCase();
  if (limpio.length > 254 || !CORREO.test(limpio)) return null;
  return limpio;
}

export type TipoContacto = 'CELULAR' | 'CORREO';

/** Decide si lo escrito es un correo o un celular y lo normaliza. */
export function interpretarContacto(
  valor: string,
): { readonly tipo: TipoContacto; readonly valor: string } | null {
  if (valor.includes('@')) {
    const correo = normalizarCorreo(valor);
    return correo ? { tipo: 'CORREO', valor: correo } : null;
  }
  const celular = normalizarCelular(valor);
  return celular ? { tipo: 'CELULAR', valor: celular } : null;
}

/**
 * Contacto enmascarado para pantallas de personal.
 *
 * Quien atiende la caja o revisa el panel no necesita el correo completo para
 * reconocer a alguien; mostrarlo entero solo multiplica dónde puede filtrarse.
 */
export function enmascararContacto(valor: string | null | undefined): string {
  if (!valor) return '—';
  if (valor.includes('@')) {
    const [usuario = '', dominio = ''] = valor.split('@');
    return `${usuario.slice(0, 2)}•••@${dominio}`;
  }
  return valor.replace(/\d(?=\d{4})/g, '•');
}

/** "2281234567" → "228 123 4567". */
export function formatoCelular(celular: string): string {
  return celular.length === 10
    ? `${celular.slice(0, 3)} ${celular.slice(3, 6)} ${celular.slice(6)}`
    : celular;
}

// ---------------------------------------------------------------------------
// Código de la tarjeta
// ---------------------------------------------------------------------------

/**
 * Alfabeto del código público. Sin 0/O, 1/I/L ni U/V para que se pueda dictar
 * y teclear sin confusiones.
 */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTWXYZ23456789';

/** Prefijo del código cuando el negocio no eligió uno. */
export const PREFIJO_CODIGO_POR_OMISION = 'WL';

/** Un prefijo válido: de dos a cuatro letras o números, en mayúsculas. */
export function esPrefijoCodigo(prefijo: string): boolean {
  return /^[A-Z0-9]{2,4}$/.test(prefijo);
}

/**
 * Forma el código "XX-XXXX-XXXX" a partir de bytes aleatorios y del prefijo
 * del negocio.
 *
 * La aleatoriedad la pone quien llama (con `crypto` en el servidor), para que
 * esta función siga siendo pura y se pueda probar.
 */
export function formarCodigoTarjeta(
  bytes: ArrayLike<number>,
  prefijo: string = PREFIJO_CODIGO_POR_OMISION,
): string {
  if (bytes.length < 8) throw new Error('Se necesitan al menos 8 bytes para el código.');
  if (!esPrefijoCodigo(prefijo)) throw new Error('El prefijo del código no es válido.');
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO_CODIGO[bytes[i]! % ALFABETO_CODIGO.length];
  return `${prefijo}-${s.slice(0, 4)}-${s.slice(4)}`;
}

const CUERPO_CODIGO = new RegExp(`^[${ALFABETO_CODIGO}]{8}$`);

/**
 * Saca el código de lo que entregue el lector: el QR completo (una dirección
 * que termina en el código), el código con o sin guiones, o tecleado en
 * minúsculas. Devuelve null si no hay un código válido de este negocio.
 */
export function extraerCodigoTarjeta(
  texto: string,
  prefijo: string = PREFIJO_CODIGO_POR_OMISION,
): string | null {
  const ultimo =
    texto
      .trim()
      .split(/[/?#=]/)
      .filter(Boolean)
      .pop() ?? '';
  const crudo = ultimo.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sinPrefijo =
    crudo.startsWith(prefijo) && crudo.length === 8 + prefijo.length
      ? crudo.slice(prefijo.length)
      : crudo;
  if (!CUERPO_CODIGO.test(sinPrefijo)) return null;
  return `${prefijo}-${sinPrefijo.slice(0, 4)}-${sinPrefijo.slice(4)}`;
}

/** ¿Es un código de verificación de seis dígitos? */
export function esCodigoVerificacion(valor: string): boolean {
  return /^\d{6}$/.test(valor.trim());
}

/** Día y mes de cumpleaños válidos (sin año: no se pide). Acepta 29 de febrero. */
export function esCumpleanosValido(dia: number, mes: number): boolean {
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || mes < 1 || mes > 12 || dia < 1) {
    return false;
  }
  const diasDelMes = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]!;
  return dia <= diasDelMes;
}
