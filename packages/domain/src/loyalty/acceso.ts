import { interpretarContacto, type TipoContacto } from './contacto';

/**
 * Entrar a la tarjeta con «correo o celular + contraseña».
 *
 * Reglas decididas por el dueño del producto (25 oct 2026). Aquí solo vive lo
 * que se puede decidir sin base de datos: cómo se lee el dato de acceso, qué
 * contraseña se acepta y cuándo hay que frenar a quien prueba contraseñas.
 * Guardar, contar intentos y abrir sesión vive en
 * `packages/database/src/lealtad/acceso.ts`.
 */

// ---------------------------------------------------------------------------
// Dato de acceso
// ---------------------------------------------------------------------------

/**
 * Lo que la persona escribe en «Correo o celular», ya normalizado.
 *
 * El celular queda en diez dígitos aunque llegue con +52, espacios o guiones
 * (`normalizarCelular`); el correo, en minúsculas y sin espacios. Una sola
 * contraseña por tarjeta: da igual cuál de los dos escriba.
 */
export function leerDatoDeAcceso(
  valor: string,
): { readonly tipo: TipoContacto; readonly valor: string } | null {
  return interpretarContacto(valor.trim());
}

// ---------------------------------------------------------------------------
// Política de contraseña
// ---------------------------------------------------------------------------

export const CONTRASENA_MINIMO = 8;
export const CONTRASENA_MAXIMO = 128;

/**
 * Contraseñas que aparecen en cualquier lista de filtraciones, más las que
 * se le ocurren a cualquiera en México. Solo las de 8 caracteres o más: las
 * cortas ya las rechaza la longitud.
 */
const COMUNES = new Set([
  '12345678',
  '123456789',
  '1234567890',
  '0123456789',
  '87654321',
  '987654321',
  '11111111',
  '00000000',
  '12341234',
  '12121212',
  '11223344',
  '123123123',
  '123456123456',
  '147258369',
  '159753456',
  'password',
  'password1',
  'password123',
  'passw0rd',
  'p@ssw0rd',
  'contraseña',
  'contrasena',
  'contraseña1',
  'contrasena1',
  'contraseña123',
  'contrasena123',
  'micontraseña',
  'micontrasena',
  'qwertyui',
  'qwerty123',
  'qwertyuiop',
  'qwerty12',
  'asdfghjk',
  'asdfasdf',
  'zxcvbnm1',
  '1q2w3e4r',
  '1q2w3e4r5t',
  'q1w2e3r4',
  'abc12345',
  'abcd1234',
  'abcdefgh',
  'a1b2c3d4',
  'aa123456',
  'iloveyou',
  'iloveyou1',
  'teamo123',
  'teamomucho',
  'tequiero',
  'tequiero1',
  'princesa',
  'princesa1',
  'mariposa',
  'corazon1',
  'amorcito',
  'amordemivida',
  'mexico123',
  'mexico2026',
  'xalapa123',
  'veracruz',
  'veracruz1',
  'america1',
  'chivas123',
  'cruzazul',
  'barcelona',
  'realmadrid',
  'futbol123',
  'sunshine',
  'football',
  'baseball',
  'superman',
  'batman123',
  'pokemon1',
  'starwars',
  'master123',
  'welcome1',
  'bienvenido',
  'admin123',
  'administrador',
  'trustno1',
  'dragon123',
  'monkey123',
  'letmein1',
  'changeme',
  'cambiame',
  'secreto1',
]);

/** Palabras que, solas o junto al nombre del negocio, no hacen una contraseña. */
const RELLENO_MARCA = new Set(['', 'mx', 'com', 'app', 'club']);

/** Sustituciones típicas: «c4f3», «c@fe», «1una». */
const LEET: Record<string, string> = {
  '4': 'a',
  '@': 'a',
  '0': 'o',
  '1': 'l',
  '|': 'l',
  '3': 'e',
  '5': 's',
  $: 's',
  '7': 't',
};

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Nombre del negocio reducido a sus letras: "Café La Parroquia" → "cafelaparroquia". */
function letrasDeMarca(nombre: string): string {
  return sinAcentos(nombre.toLowerCase()).replace(/[^a-z]/g, '');
}

/**
 * ¿Es el nombre del negocio con números, signos o sustituciones alrededor?
 *
 * Se compara contra el nombre completo y contra cada palabra de cuatro letras
 * o más. Se mira de dos formas: con todas las sustituciones («c4fe» → «cafe»)
 * y tirando los dígitos. Basta con que una de las dos deje solo la marca, o
 * la marca y algo de relleno.
 */
function esVarianteDeMarca(minusculas: string, negocio: string): boolean {
  const marcas = new Set<string>();
  const completa = letrasDeMarca(negocio);
  if (completa.length >= 4) marcas.add(completa);
  for (const palabra of sinAcentos(negocio.toLowerCase()).split(/[^a-z]+/)) {
    if (palabra.length >= 4) marcas.add(palabra);
  }
  if (marcas.size === 0) return false;

  const base = sinAcentos(minusculas).split('');
  const lecturas = [
    base.map((c) => LEET[c] ?? c).join(''),
    base.map((c) => (/\d/.test(c) ? '' : (LEET[c] ?? c))).join(''),
  ];
  return lecturas.some((lectura) => {
    const letras = lectura.replace(/[^a-z]/g, '');
    return [...marcas].some((marca) => {
      if (!letras.includes(marca)) return false;
      const resto = letras.replaceAll(marca, '');
      return resto.length < 3 || RELLENO_MARCA.has(resto);
    });
  });
}

/** Filas del teclado y de los dígitos, para «qwertyui» o «asdfghjk». */
const FILAS = ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm', '1234567890'];

/**
 * ¿Es una secuencia? «abcdefgh», «12345678», «87654321», «qwertyui» y sus
 * versiones al revés o que dan la vuelta («78901234»).
 */
function esSecuencia(minusculas: string): boolean {
  const c = [...minusculas];
  if (c.length < 3) return false;

  const pasos = c.slice(1).map((x, i) => x.codePointAt(0)! - c[i]!.codePointAt(0)!);
  if (pasos.every((p) => p === 1) || pasos.every((p) => p === -1)) return true;

  const reves = [...c].reverse().join('');
  return FILAS.some((fila) => {
    const vuelta = fila.repeat(Math.ceil(c.length / fila.length) + 1);
    return vuelta.includes(minusculas) || vuelta.includes(reves);
  });
}

/**
 * Valida una contraseña nueva de la tarjeta. Devuelve null si sirve, o el
 * motivo para mostrarlo en el formulario.
 *
 * Sin reglas de mayúsculas ni símbolos (decisión del producto): producen
 * «Negocio2026!», fácil de adivinar y difícil de recordar. En su lugar se
 * rechaza lo obvio: lo de las listas, el nombre del negocio, un carácter repetido, una
 * secuencia y el propio celular de la tarjeta.
 */
export function validarContrasenaTarjeta(
  clave: string,
  contexto: { readonly celular?: string | null; readonly negocio?: string | null } = {},
): string | null {
  const largo = [...clave].length;
  if (largo < CONTRASENA_MINIMO) {
    return `Usa al menos ${CONTRASENA_MINIMO} caracteres. Una frase que recuerdes funciona mejor que algo corto y complicado.`;
  }
  if (largo > CONTRASENA_MAXIMO) {
    return `Usa como máximo ${CONTRASENA_MAXIMO} caracteres.`;
  }

  const minusculas = clave.normalize('NFKC').toLowerCase();
  const compacta = minusculas.replace(/[\s.\-_]/g, '');

  if (new Set(compacta).size <= 1) {
    return 'No uses un mismo carácter repetido.';
  }
  if (esSecuencia(compacta)) {
    return 'No uses una secuencia como «12345678» o «abcdefgh».';
  }
  if (COMUNES.has(minusculas) || COMUNES.has(compacta) || COMUNES.has(sinAcentos(compacta))) {
    return 'Esa contraseña es de las más usadas y se adivina fácil. Elige otra.';
  }
  if (contexto.negocio && esVarianteDeMarca(compacta, contexto.negocio)) {
    return 'No uses el nombre del negocio ni variantes suyas como contraseña.';
  }

  const celular = contexto.celular?.replace(/\D/g, '') ?? '';
  if (celular.length >= 10) {
    const digitos = compacta.replace(/^\+/, '');
    const soloDigitos = /^\d+$/.test(digitos);
    const contiene = compacta.replace(/\D/g, '').includes(celular.slice(-10));
    if (
      contiene ||
      (soloDigitos && digitos.length >= CONTRASENA_MINIMO && celular.includes(digitos))
    ) {
      return 'No uses tu número de celular como contraseña.';
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Bloqueo por intentos fallidos
// ---------------------------------------------------------------------------

export const MAX_FALLOS_ACCESO = 5;
export const MINUTOS_BLOQUEO_ACCESO = 15;

export interface IntentoAcceso {
  readonly fecha: Date;
  readonly exito: boolean;
}

export type EstadoBloqueo =
  | { readonly bloqueado: false; readonly fallos: number }
  | { readonly bloqueado: true; readonly hasta: Date; readonly fallos: number };

/**
 * ¿Hay que rechazar el siguiente intento sin comprobar la contraseña?
 *
 * Se bloquea 15 minutos tras 5 fallos dentro de la ventana de 15 minutos. El
 * bloqueo termina cuando el quinto fallo más reciente sale de la ventana: los
 * intentos rechazados por estar bloqueado no se registran, así que no alargan
 * el castigo.
 *
 * - `desde`: los fallos anteriores no cuentan (p. ej. la fecha en que se fijó
 *   la contraseña vigente: quien la restableció entra de inmediato).
 * - `reiniciaConExito`: para la tarjeta, una entrada correcta borra los
 *   fallos previos. Para la IP no: quien tiene una tarjeta propia no debe
 *   poder «limpiar» su IP entrando a ella entre intento e intento.
 */
export function evaluarBloqueo(
  intentos: readonly IntentoAcceso[],
  ahora: Date,
  opciones: {
    readonly desde?: Date | null;
    readonly reiniciaConExito?: boolean;
    readonly maxFallos?: number;
    readonly minutos?: number;
  } = {},
): EstadoBloqueo {
  const maxFallos = opciones.maxFallos ?? MAX_FALLOS_ACCESO;
  const ventanaMs = (opciones.minutos ?? MINUTOS_BLOQUEO_ACCESO) * 60 * 1000;
  const inicioVentana = ahora.getTime() - ventanaMs;
  const desde = Math.max(inicioVentana, opciones.desde?.getTime() ?? -Infinity);

  const recientes = intentos
    .filter((i) => i.fecha.getTime() > desde && i.fecha.getTime() <= ahora.getTime())
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const fallos: Date[] = [];
  for (const i of recientes) {
    if (i.exito) {
      if (opciones.reiniciaConExito) break;
      continue;
    }
    fallos.push(i.fecha);
  }

  if (fallos.length < maxFallos) return { bloqueado: false, fallos: fallos.length };
  const hasta = new Date(fallos[maxFallos - 1]!.getTime() + ventanaMs);
  return hasta > ahora
    ? { bloqueado: true, hasta, fallos: fallos.length }
    : { bloqueado: false, fallos: fallos.length };
}

// ---------------------------------------------------------------------------
// Solicitudes de acceso (tarjetas solo con celular)
// ---------------------------------------------------------------------------

/** Una solicitud abierta vence a las 48 horas. */
export const HORAS_SOLICITUD_ACCESO = 48;
/** El enlace que la sucursal manda por WhatsApp dura 24 horas. */
export const HORAS_ENLACE_WHATSAPP = 24;
/** Solicitudes por IP y hora. Frena a quien quiera llenar la caja de avisos. */
export const MAX_SOLICITUDES_POR_IP_HORA = 5;

/** Respuesta en pantalla de «Olvidé mi contraseña», exista o no la tarjeta. */
export const RESPUESTA_OLVIDE_CONTRASENA =
  'Si encontramos tu tarjeta, te llegará un enlace a tu correo o tu sucursal te lo enviará por WhatsApp en horario de atención.';

/** Error único de «Entrar», sea cual sea la causa. */
export const ERROR_ACCESO_GENERICO = 'Correo, celular o contraseña incorrectos.';

export function venceSolicitud(creada: Date): Date {
  return new Date(creada.getTime() + HORAS_SOLICITUD_ACCESO * 60 * 60 * 1000);
}

/** "hace 3 min", "hace 2 h", "hace 1 día": cuánto lleva esperando la persona. */
export function haceCuanto(desde: Date, ahora: Date): string {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - desde.getTime()) / 60000));
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

/** Mensaje de WhatsApp con el enlace para crear contraseña nueva. */
export function mensajeEnlaceAcceso(nombre: string | null, url: string, negocio: string): string {
  const saludo = nombre?.trim() ? `Hola ${nombre.trim().split(/\s+/)[0]}` : 'Hola';
  return [
    `${saludo}, te escribimos de ${negocio}. Aquí está tu enlace para entrar a tu tarjeta de lealtad y crear una contraseña nueva. Sirve una sola vez y vence en ${HORAS_ENLACE_WHATSAPP} horas:`,
    url,
    'Importante: ábrelo en Safari o Chrome, no dentro de WhatsApp (mantén presionado el enlace → «Abrir en el navegador»). Así tu tarjeta queda guardada en tu celular.',
    'Si no pediste este enlace, ignora este mensaje.',
  ].join('\n\n');
}
