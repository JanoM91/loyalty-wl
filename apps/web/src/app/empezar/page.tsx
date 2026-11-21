import { PaginaAlta } from '@/components/sitio/PaginaAlta';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Crea tu club gratis',
  'Crea en minutos la tarjeta de cliente frecuente de tu negocio. Tus clientes la guardan en su celular. 7 días gratis.',
);

export default async function Empezar() {
  await exigirSitioDelServicio();
  return (
    <PaginaAlta
      ruta="/empezar"
      etiqueta="Prueba gratis"
      titulo="Tu tarjeta de cliente frecuente, en 5 minutos."
      texto="En el celular de tus clientes. Sin app y sin papel."
      pasos={[
        ['Respondes 3 preguntas', 'Tu negocio, tu premio y tu acceso. Entras directo a tu panel.'],
        ['Sacas tu propia tarjeta', 'La pruebas en tu celular antes que nadie.'],
        [
          'Pones tu QR a la vista',
          'Cada visita suma un sello. Tu cliente ve su avance en su celular.',
        ],
      ]}
    />
  );
}
