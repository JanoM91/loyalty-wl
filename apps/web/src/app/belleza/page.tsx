import { PaginaAlta } from '@/components/sitio/PaginaAlta';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Tarjeta de cliente frecuente para salones y barberías',
  'Crea en minutos la tarjeta de sellos de tu salón, barbería o estudio de uñas. Tus clientes la guardan en su celular. 7 días gratis.',
);

export default async function Belleza() {
  await exigirSitioDelServicio();
  return (
    <PaginaAlta
      ruta="/belleza"
      grupo="belleza"
      etiqueta="Salones, uñas y barberías"
      titulo="Que tu cliente vuelva contigo, no con otro."
      texto="Tu tarjeta de cliente frecuente, en su celular. Lista en 5 minutos."
      pasos={[
        ['Respondes 3 preguntas', 'Tu negocio, tu premio y tu acceso. Entras directo a tu panel.'],
        ['Sacas tu propia tarjeta', 'La pruebas en tu celular antes que nadie.'],
        [
          'Pones tu QR en recepción',
          'Cada cita suma un sello. Tu cliente ve su avance en su celular.',
        ],
      ]}
    />
  );
}
