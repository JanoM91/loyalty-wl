/**
 * Envuelve una acción de servidor para `useActionState`: cuando su resultado
 * dice a dónde ir, abre esa página con una carga completa en cuanto llega la
 * respuesta.
 *
 * Por qué: con Next 15.5 y React 19.3, si la acción hace que Next vuelva a
 * pintar la página (renueva la sesión, `revalidatePath`…), a veces ese
 * repintado no termina nunca. Lo guardado sí queda, pero la pantalla se queda
 * en «Guardando…». Un `useEffect` que recarga tampoco sirve: corre después de
 * ese repintado. Aquí la carga sale sin esperar a React.
 *
 * Se define a nivel de módulo, no dentro del componente:
 *
 *     const pagoYRecargar = recargarAlTerminar(pago, (e) => e.recargar);
 *     const [estado, accion] = useActionState(pagoYRecargar, INICIAL);
 */
export function recargarAlTerminar<Previo, Estado, Datos>(
  accion: (previo: Previo, datos: Datos) => Promise<Estado>,
  destino: (estado: Estado) => string | null | undefined,
): (previo: Previo, datos: Datos) => Promise<Estado> {
  return async (previo, datos) => {
    const estado = await accion(previo, datos);
    const url = destino(estado);
    if (url) window.location.assign(url);
    return estado;
  };
}
