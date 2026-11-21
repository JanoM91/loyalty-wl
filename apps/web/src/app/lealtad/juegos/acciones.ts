'use server';

import { iniciarPartida, terminarPartida, type CuponArcade } from '@wl/database';

import { tarjetaDeEsteNavegador } from '@/lib/lealtad/sesion';

/**
 * Partidas del Arcade del club.
 *
 * El navegador solo pide abrir y cerrar una partida. Si hoy se puede jugar,
 * cuánto duró y si el puntaje es creíble lo decide el servidor; los cupones
 * los entrega solo, al cerrar la partida.
 */

export type RespuestaInicio =
  | { readonly ok: true; readonly id: string; readonly semilla: number; readonly quedanHoy: number }
  | { readonly ok: false; readonly error: string };

export type RespuestaFin =
  | {
      readonly ok: true;
      readonly puntos: number;
      readonly sospechosa: boolean;
      readonly cupones: readonly Pick<CuponArcade, 'codigo' | 'titulo' | 'vence'>[];
    }
  | { readonly ok: false; readonly error: string };

const SIN_SESION = 'Abre tu tarjeta en este celular para jugar.';
const FALLA = 'No pudimos guardar tu partida. Revisa tu conexión e inténtalo otra vez.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function empezarPartida(juego: string): Promise<RespuestaInicio> {
  const tarjeta = await tarjetaDeEsteNavegador();
  if (!tarjeta) return { ok: false, error: SIN_SESION };
  try {
    return await iniciarPartida(tarjeta, String(juego).slice(0, 20));
  } catch (err) {
    console.error('[arcade] Error al abrir partida:', err);
    return { ok: false, error: FALLA };
  }
}

export async function cerrarPartida(
  partida: string,
  puntos: number,
  nivel: number,
): Promise<RespuestaFin> {
  const tarjeta = await tarjetaDeEsteNavegador();
  if (!tarjeta) return { ok: false, error: SIN_SESION };
  if (!UUID.test(String(partida))) return { ok: false, error: 'Esta partida ya terminó.' };
  try {
    const r = await terminarPartida(
      tarjeta,
      String(partida),
      Math.trunc(Number(puntos) || 0),
      Math.trunc(Number(nivel) || 1),
    );
    if (!r.ok) return r;
    return {
      ok: true,
      puntos: r.puntos,
      sospechosa: r.sospechosa,
      cupones: r.cuponesNuevos.map((c) => ({ codigo: c.codigo, titulo: c.titulo, vence: c.vence })),
    };
  } catch (err) {
    console.error('[arcade] Error al cerrar partida:', err);
    return { ok: false, error: FALLA };
  }
}
