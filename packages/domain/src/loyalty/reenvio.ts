/**
 * Volver a mandar el enlace de la tarjeta desde la caja.
 *
 * Caso real (MonteMagno, 5 nov 2026): un cliente dado de alta en caja no abrió
 * a tiempo el enlace de bienvenida (dura 3 días). Volvió, la caja le acreditó
 * la visita con «Registrar visita sin tarjeta», pero no había cómo mandarle
 * otro enlace. Ahora la caja lo reenvía al contacto **registrado** de la
 * tarjeta (WhatsApp o correo) o lo muestra en QR.
 *
 * Aquí solo están las reglas y los textos; el envío vive en la app.
 */

/** El enlace reenviado dura lo mismo que el de bienvenida: tres días. */
export const HORAS_ENLACE_REENVIO = 72;

/** Por dónde sale el enlace. `PANTALLA` es el QR que se escanea ahí mismo. */
export type CanalReenvio = 'WHATSAPP' | 'CORREO' | 'PANTALLA';

export const CANALES_REENVIO: readonly CanalReenvio[] = ['WHATSAPP', 'CORREO', 'PANTALLA'];

export function esCanalReenvio(valor: unknown): valor is CanalReenvio {
  return typeof valor === 'string' && (CANALES_REENVIO as readonly string[]).includes(valor);
}

/** "3 días", "1 día", "24 horas", "15 minutos": cuánto dura un enlace. */
export function vigenciaEnlace(minutos: number): string {
  if (minutos < 60) return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
  const horas = Math.round(minutos / 60);
  if (horas < 48 || horas % 24 !== 0) return horas === 1 ? '1 hora' : `${horas} horas`;
  const dias = horas / 24;
  return dias === 1 ? '1 día' : `${dias} días`;
}

/** "Hola Mariana" con el primer nombre, o "Hola" si la tarjeta no tiene nombre. */
export function saludoTarjeta(nombre: string | null | undefined): string {
  const primero = nombre?.trim().split(/\s+/)[0];
  return primero ? `Hola ${primero}` : 'Hola';
}

/** "ya lleva 1 estampa" / "ya lleva 4 estampas" / "ya está lista". */
function estadoEstampas(estampas: number): string {
  if (estampas <= 0) return 'ya está lista';
  return estampas === 1 ? 'ya lleva 1 sello' : `ya lleva ${estampas} sellos`;
}

export interface DatosReenvio {
  readonly nombre: string | null;
  readonly estampas: number;
  readonly url: string;
  /** Todavía no tiene contraseña: al abrir el enlace la va a crear. */
  readonly creaContrasena: boolean;
  /** Nombre del negocio, como lo conoce el cliente. */
  readonly negocio: string;
  /** Dirección para entrar después, sin protocolo: "minegocio.ejemplo.mx". */
  readonly sitio: string;
  /** Minutos que dura el enlace. */
  readonly minutos: number;
  /**
   * El enlace es el personal permanente (nov 2026): no vence ni pide
   * contraseña. Cambia el texto de «qué pasa al abrirlo».
   */
  readonly permanente?: boolean;
}

/** Qué pasa al abrirlo y cómo entra después, según tenga o no contraseña. */
function despues(d: DatosReenvio, dato: 'tu celular' | 'tu correo'): string {
  if (d.permanente) {
    return 'Es tu enlace personal: guárdalo, sirve siempre y en cualquier celular, sin contraseña. Al abrirlo, agrega tu tarjeta a Apple Wallet o Google Wallet para tenerla a la mano. No lo compartas.';
  }
  const vigencia = `El enlace sirve una sola vez y vence en ${vigenciaEnlace(d.minutos)}.`;
  return d.creaContrasena
    ? `Al abrirlo, crea tu contraseña: con ella y ${dato} entras cuando quieras en ${d.sitio}. ${vigencia}`
    : `Al abrirlo, tu tarjeta queda abierta en tu celular; después entras con ${dato} y tu contraseña en ${d.sitio}. ${vigencia}`;
}

/** Mensaje de WhatsApp que la caja manda al celular registrado de la tarjeta. */
export function mensajeReenvioWhatsApp(d: DatosReenvio): string {
  return [
    `${saludoTarjeta(d.nombre)}, te escribimos de ${d.negocio}. Aquí está de nuevo el enlace de tu tarjeta de lealtad; ${estadoEstampas(d.estampas)}.`,
    d.url,
    despues(d, 'tu celular'),
    'Importante: ábrelo en Safari o Chrome, no dentro de WhatsApp (mantén presionado el enlace → «Abrir en el navegador»). Así tu tarjeta queda guardada en tu celular.',
  ].join('\n\n');
}

/** Asunto y párrafos del correo con el enlace (el botón lo pone la plantilla). */
export function correoReenvio(d: DatosReenvio): {
  readonly asunto: string;
  readonly titulo: string;
  readonly parrafos: readonly string[];
} {
  return {
    asunto: `Tu tarjeta de lealtad de ${d.negocio} te espera`,
    titulo: 'Tu tarjeta te espera',
    parrafos: [
      `${saludoTarjeta(d.nombre)}, te mandamos de nuevo el enlace de tu tarjeta de lealtad de ${d.negocio}; ${estadoEstampas(d.estampas)}.`,
      `Toca el botón desde tu celular. ${despues(d, 'tu correo')}`,
      'Si no pediste este enlace, ignora este correo.',
    ],
  };
}
