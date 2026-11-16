import { headers } from 'next/headers';

import { ruta } from '@/lib/negocio';
import { googleWalletPublico } from '@/lib/wallet/google/config';

/**
 * «Agregar a Google Wallet».
 *
 * Aparece cuando el servicio está configurado y el navegador no es de Apple
 * (en iPhone el pase es el de Apple Wallet). El enlace crea o actualiza el
 * objeto en Google y redirige a la página de «Guardar» de Google Wallet.
 *
 * El botón es propio. Si el negocio quiere la insignia oficial, se descarga de
 * Google y se coloca en public/wallet/ siguiendo sus lineamientos.
 */
export async function BotonGoogleWallet() {
  // Oculto mientras Google tenga la cuenta en modo demostración.
  if (!googleWalletPublico()) return null;
  const ua = (await headers()).get('user-agent') ?? '';
  const esApple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  if (esApple) return null;

  return (
    <a
      href={await ruta('/lealtad/tarjeta/google-wallet')}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black/90"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
        <rect x="3" y="6" width="18" height="13" rx="2.5" fill="#fff" fillOpacity=".92" />
        <rect x="3" y="9.5" width="18" height="3" fill="#111" fillOpacity=".55" />
        <rect x="13.5" y="13.5" width="5" height="2.5" rx="1" fill="#111" fillOpacity=".55" />
      </svg>
      Agregar a Google Wallet
    </a>
  );
}
