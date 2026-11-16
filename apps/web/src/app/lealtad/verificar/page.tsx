import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { exigirTarjeta } from '@/lib/lealtad/sesion';
import { CORREO_CONFIGURADO } from '@/lib/correo';
import { Aviso } from '@/components/lealtad/Aviso';
import { FormularioVerificar } from './FormularioVerificar';
import { ruta } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Verifica tu correo' };
export const dynamic = 'force-dynamic';

export default async function VerificarPage() {
  const t = await exigirTarjeta();
  if (!t.correo) redirect(await ruta('/lealtad/perfil#correo'));
  if (t.correoVerificado) redirect(await ruta('/lealtad/tarjeta'));

  return (
    <>
      <div className="grid gap-1">
        <a href="/lealtad/tarjeta" className="text-sm text-crust-dark underline underline-offset-4">
          ← Mi tarjeta
        </a>
        <h1 className="text-2xl text-ink">Verifica tu correo</h1>
        <p className="text-sm text-ink-soft">
          Te enviaremos un código de 6 dígitos a{' '}
          <b className="font-mono font-semibold text-ink">{t.correo}</b>. Vence en 10 minutos y
          sirve una sola vez.
        </p>
      </div>
      {!CORREO_CONFIGURADO && (
        <Aviso tono="atencion" titulo="El envío de correos todavía no está activo">
          El negocio está terminando de configurarlo. Tus estampas siguen sumando mientras tanto.
        </Aviso>
      )}
      <FormularioVerificar />
      <p className="text-xs text-muted">
        ¿Prefieres una contraseña propia? No hace falta: tu tarjeta se abre con un enlace a tu
        correo verificado. Nunca te pediremos una contraseña por mensaje.
      </p>
    </>
  );
}
