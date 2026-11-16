/**
 * La dirección de una foto la manda el navegador de la caja, así que no se
 * cree sin más: solo vale si es del almacén de fotos y de la carpeta de este
 * negocio. Lo demás se descarta (se guarda sin foto).
 */
export function fotoDelNegocio(url: string | null | undefined, negocioId: string): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!u.hostname.endsWith('.blob.vercel-storage.com')) return null;
  if (!u.pathname.startsWith(`/negocios/${negocioId}/lealtad/`)) return null;
  return u.toString();
}
