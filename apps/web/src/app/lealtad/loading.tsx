import { Cargando } from '@/components/Cargando';

/** Mientras carga la tarjeta: la animación con los colores del negocio, sin la marca de club-lealtad. */
export default function CargandoTarjeta() {
  return <Cargando variante="negocio" alto="area" />;
}
