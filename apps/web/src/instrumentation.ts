/**
 * Se ejecuta una vez al arrancar el servidor.
 *
 * Registra de dónde sale el negocio de cada consulta: del subdominio de la
 * petición. Va aquí, y no en un layout, para que también valga en las
 * acciones de servidor y en las rutas de API, que no pasan por los layouts.
 */
export async function register(): Promise<void> {
  // La condición va escrita así, en positivo y envolviendo el import, para
  // que el empaquetador deje esto fuera del entorno «edge» (el middleware),
  // donde no hay base de datos.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
