import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { enviarCorreo, plantillaCorreo, type ResultadoCorreo } from '@/lib/correo';
import { fechaLarga } from '@/lib/lealtad/formato';

/**
 * Correo de bienvenida al dueño que crea su club en el asistente. Lo manda
 * club-lealtad (no el negocio): remitente de la plataforma y sus colores.
 *
 * Sin Resend configurado no sale nada y el alta sigue igual: la pantalla
 * final ya le da la dirección de su panel.
 */
export async function mandarBienvenida(datos: {
  readonly para: string;
  readonly club: string;
  /** Dirección completa del club: `https://club-lealtad.com/barberia-leon`. */
  readonly direccion: string;
  /** Fin de la prueba gratis (ISO). */
  readonly pruebaVence: string;
}): Promise<ResultadoCorreo> {
  const panel = `${datos.direccion}/admin`;
  const vence = fechaLarga(new Date(datos.pruebaVence));
  // Enlace corto, sin mensaje armado: en el correo se lee completo.
  const ayuda = enlaceWhatsAppServicio('').split('?')[0]!;
  const parrafos = [
    `Hola: ${datos.club} ya tiene su programa de lealtad. Tu prueba gratis dura hasta el ${vence}, con todo incluido.`,
    `Tu panel está en ${panel}. Entras con este correo y la contraseña que elegiste. Agrégalo a la pantalla de inicio de tu celular para tenerlo a la mano.`,
    'Arranca en 3 pasos: 1) saca tu propia tarjeta; 2) súmate tu primer sello en la caja; 3) imprime o comparte tu cartel QR y ponlo donde cobras.',
    `Tus clientes escanean el QR al pagar, reciben su tarjeta en el celular y tú les sumas el sello desde la caja.`,
    `¿Dudas? Escríbenos por WhatsApp: ${ayuda}`,
  ];
  return enviarCorreo({
    para: datos.para,
    asunto: `Tu club ${datos.club} ya está listo`,
    texto: parrafos.join('\n\n'),
    html: plantillaCorreo(
      'Tu club ya está listo',
      parrafos,
      { texto: 'Entrar a mi panel', url: panel },
      `club-lealtad. Recibes este correo porque creaste el club ${datos.club} en club-lealtad.com.`,
    ),
  });
}
