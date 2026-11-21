/**
 * WhatsApp de club-lealtad (Exkalibur): `WL_CONTACTO_WHATSAPP` o, si falta,
 * el número de Jano. Lo usan el sitio y el panel de cada club.
 */
export function enlaceWhatsAppServicio(texto: string): string {
  const numero = (process.env.WL_CONTACTO_WHATSAPP ?? '').replace(/\D/g, '') || '522222551373';
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
