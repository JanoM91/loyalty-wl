import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exigirNegocio, rutaBase } from '@/lib/negocio';
import { NOMBRE_COOKIE_TARJETA, enlacePersonalDeTarjeta, leerSesionTarjeta } from '@wl/database';

export const dynamic = 'force-dynamic';

/**
 * Manifest de la tarjeta como aplicación: <negocio>.<dominio>/lealtad.
 *
 * Es dinámico a propósito. Cuando la persona agrega la tarjeta a su pantalla
 * de inicio, la app instalada no comparte cookies con el navegador (en iOS
 * nunca; en Android depende), así que `start_url` lleva el enlace personal
 * permanente de la tarjeta (`mi`, ver lealtad/enlace-personal.ts). Antes de
 * nov 2026 llevaba un enlace de un solo uso de 30 días: si la app perdía la
 * sesión después, ya no había forma de volver a entrar sin contraseña.
 */

export async function GET() {
  const galletas = await cookies();
  const cardId = await leerSesionTarjeta(galletas.get(NOMBRE_COOKIE_TARJETA)?.value);

  const base = await rutaBase();
  let inicio = `${base}/lealtad/app`;
  if (cardId) {
    const token = await enlacePersonalDeTarjeta(cardId);
    if (token) inicio = `${base}/lealtad/app?mi=${token}`;
  }

  const negocio = await exigirNegocio();
  const icono = negocio.marca.iconoUrl;
  const manifest = {
    name: `${negocio.nombre} · Tarjeta de lealtad`,
    short_name: negocio.nombre.slice(0, 12),
    description: `Tu tarjeta de lealtad de ${negocio.nombre}: estampas, premios y tu código para caja.`,
    id: `${base}/lealtad/app`,
    start_url: inicio,
    scope: `${base}/lealtad`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: negocio.marca.colores.fondo,
    theme_color: negocio.marca.colores.fondo,
    lang: 'es-MX',
    // Sin isotipo, el celular usa una captura de la página como ícono.
    icons: icono ? [{ src: icono, sizes: 'any', purpose: 'any' }] : [],
  };

  const respuesta = NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Lleva un enlace personal: ni la CDN ni el navegador deben guardarlo.
      'Cache-Control': 'private, no-store',
    },
  });
  return respuesta;
}
