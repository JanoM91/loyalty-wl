import {
  Cierre,
  Cinta,
  Hero,
  Marco,
  Pasos,
  Revela,
  Seccion,
  minimo,
} from '@/components/sitio/Marco';
import { exigirSitioDelServicio, metadatosDelSitio } from '@/lib/sitio';

export const dynamic = 'force-dynamic';

export const metadata = metadatosDelSitio(
  'Cómo funciona',
  'De la primera visita al premio: así se ve el programa de lealtad para el dueño, el cliente y la caja.',
);

function Rol({
  etiqueta,
  titulo,
  pasos,
  oscura = false,
}: {
  etiqueta: string;
  titulo: string;
  pasos: readonly (readonly [string, string])[];
  oscura?: boolean;
}) {
  return (
    <Seccion oscura={oscura} separacion={32}>
      <div className="col" style={{ gap: 16 }}>
        <span className="chip">{etiqueta}</span>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          {titulo}
        </h2>
      </div>
      <Pasos min={250} items={pasos} />
    </Seccion>
  );
}

export default async function ComoFunciona() {
  await exigirSitioDelServicio();
  return (
    <Marco actual="/como-funciona">
      <Hero
        etiqueta="Cómo funciona"
        titulo="De la visita al premio, sin papel"
        texto="Tres personas, tres pantallas. Así se ve para cada una."
      />
      <Cinta />
      <Rol
        etiqueta="Tú, el dueño"
        titulo="El alta la hacemos nosotros"
        pasos={[
          ['Defines', 'Premio, sellos, sucursales y colores.'],
          ['Te damos tu enlace', 'Tu club ya abre desde ese momento.'],
          ['Ajustas tu marca', 'Logo y colores con vista previa.'],
          ['Das acceso', 'Una cuenta de caja por sucursal.'],
        ]}
      />
      <Rol
        oscura
        etiqueta="Tu cliente"
        titulo="Una tarjeta que no se olvida"
        pasos={[
          ['Se registra', 'Con su celular, desde tu QR.'],
          ['La guarda', 'En Apple Wallet o Google Wallet.'],
          ['Enseña su QR', 'El mismo en Wallet y en la web.'],
          ['Recibe avisos', '«Llevas 4 de 8». «Premio listo».'],
        ]}
      />
      <Rol
        etiqueta="Tu caja"
        titulo="Sellar tarda lo que dar el cambio"
        pasos={[
          ['Escanea', 'Desde un celular o tablet.'],
          ['Anota el folio', 'Para cruzar visita y venta.'],
          ['¿Sin tarjeta?', 'Vale el folio o una foto del ticket.'],
          ['Entrega el premio', 'Se marca en la misma pantalla.'],
        ]}
      />
      <Seccion sinArriba>
        <h2 className="d h2 rise" style={{ maxWidth: '12em' }}>
          Reglas listas. Se ajustan.
        </h2>
        <div className="grid" style={minimo(240)}>
          <Revela
            titulo="1 visita al día"
            pie="Por tarjeta y sucursal"
            detras="Se ajusta por negocio."
          />
          <Revela
            titulo="Folio del ticket"
            pie="Se pide, no frena"
            detras="Puedes hacerlo obligatorio."
          />
          <Revela
            titulo="Sellos y premios"
            pie="Los que tú definas"
            detras="Cambias el número y cada premio."
          />
          <Revela
            titulo="Fotos de tickets"
            pie="90 días"
            detras="Tú decides cuánto se conservan."
          />
        </div>
      </Seccion>
      <Cierre titulo="Haz una visita de prueba en tu celular" />
    </Marco>
  );
}
