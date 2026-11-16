import { headers } from 'next/headers';

import { ruta } from '@/lib/negocio';
import { appleWalletConfigurado } from '@/lib/wallet/apple/config';

/**
 * «Agregar a Apple Wallet».
 *
 * Solo aparece cuando el servicio está configurado y el navegador es de
 * Apple: en Android no se puede instalar un .pkpass y el botón solo
 * confundiría. El enlace descarga el pase; Safari abre la hoja de Wallet.
 *
 * El botón es propio (negro, con el texto de Apple). Si el negocio quiere la
 * insignia oficial, se descarga del sitio de Apple y se coloca en
 * public/wallet/ respetando sus lineamientos de uso.
 */
export async function BotonAppleWallet() {
  if (!appleWalletConfigurado()) return null;
  const ua = (await headers()).get('user-agent') ?? '';
  const esApple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  if (!esApple) return null;

  return (
    <a
      href={await ruta('/lealtad/tarjeta/apple-wallet')}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black/90"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
        <rect x="3" y="6" width="18" height="13" rx="2.5" fill="#fff" fillOpacity=".92" />
        <rect x="3" y="9.5" width="18" height="3" fill="#111" fillOpacity=".55" />
        <rect x="13.5" y="13.5" width="5" height="2.5" rx="1" fill="#111" fillOpacity=".55" />
      </svg>
      Agregar a Apple Wallet
    </a>
  );
}
