/**
 * Avisos a los pases de Apple y Google Wallet cuando una tarjeta cambia.
 *
 * **Pendiente de la Fase 4.** Las pantallas ya llaman a estas funciones en
 * los puntos correctos (acreditar, entregar premio, cambiar el programa); hoy
 * no hacen nada porque los pases todavía no existen en Loyalty WL.
 */

export async function avisarCambioDeTarjeta(_cardId: string): Promise<void> {}

export async function avisarCambioPorCodigo(_codigo: string): Promise<void> {}

export async function avisarCambioPorAcreditacion(_accrualId: string): Promise<void> {}
