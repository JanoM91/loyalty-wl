import { qrSvg, urlTarjeta } from '@/lib/lealtad/qr';

/**
 * El código que se muestra en caja.
 *
 * Lleva una dirección con el código de la tarjeta y nada más: ni teléfono ni
 * correo. Si alguien le toma foto, no obtiene datos de nadie.
 */
export async function CodigoQR({
  codigo,
  tamano = 'md',
}: {
  codigo: string;
  tamano?: 'md' | 'lg';
}) {
  const svg = await qrSvg(await urlTarjeta(codigo));
  const lado = tamano === 'lg' ? 'w-60' : 'w-44';
  return (
    <div className="grid justify-items-center gap-2 text-center">
      <div
        role="img"
        aria-label={`Código QR de la tarjeta ${codigo}`}
        className={`${lado} aspect-square max-w-full rounded-md bg-white p-2 [&_svg]:h-full [&_svg]:w-full`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span className="font-mono text-[13px] tracking-[0.08em] text-ink">{codigo}</span>
    </div>
  );
}
