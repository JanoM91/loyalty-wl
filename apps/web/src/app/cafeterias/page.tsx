import { PaginaAlta } from '@/components/sitio/PaginaAlta';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Tarjeta de cliente frecuente para cafeterías y panaderías',
  'Crea en minutos la tarjeta de sellos de tu cafetería, panadería o repostería. Tus clientes la guardan en su celular. 7 días gratis.',
);

export default async function Cafeterias() {
  await exigirSitioDelServicio();
  return (
    <PaginaAlta
      ruta="/cafeterias"
      grupo="cafe"
      etiqueta="Cafeterías, panaderías y reposterías"
      titulo="Tu tarjeta de sellos, sin cartón."
      texto="En el celular de tus clientes. Lista en 5 minutos."
      pasos={[
        ['Llenas cinco datos', 'Nombre, giro, premio, WhatsApp y correo.'],
        ['Sacas tu propia tarjeta', 'La pruebas en tu celular antes que nadie.'],
        ['Pones tu QR en el mostrador', 'Cada visita suma un sello. El premio avisa solo.'],
      ]}
    />
  );
}
