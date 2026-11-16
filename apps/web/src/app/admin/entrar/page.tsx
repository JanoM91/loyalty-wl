import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { sesionActual } from '@/lib/admin/sesion';
import { FormularioAcceso } from './FormularioAcceso';
import { LogoMarca } from '@/components/Marca';
import { ruta } from '@/lib/negocio';

export const metadata: Metadata = {
  title: 'Entrar · Panel',
  robots: { index: false, follow: false },
};

// Sin caché: el resultado depende de quién pregunta.
export const dynamic = 'force-dynamic';

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ contrasena?: string }>;
}) {
  // Quien ya tiene sesión no necesita ver esta pantalla.
  if (await sesionActual()) redirect(await ruta('/admin'));
  const { contrasena } = await searchParams;

  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4"
    >
      <div className="pb-10">
        <LogoMarca sobre="claro" className="h-12 text-2xl text-ink" />
        <h1 className="mt-1 text-lg text-ink-soft">Panel de administración</h1>
      </div>

      {contrasena === 'lista' && (
        <p
          role="status"
          className="mb-4 border-l-[3px] border-disponible bg-cream px-4 py-3 text-sm text-ink"
        >
          Contraseña guardada. Ya puedes entrar con ella.
        </p>
      )}

      <FormularioAcceso />

      <p className="mt-8 text-sm">
        <a href="/admin/entrar/recuperar" className="text-ink underline underline-offset-4">
          ¿Olvidaste tu contraseña?
        </a>
      </p>
    </main>
  );
}
