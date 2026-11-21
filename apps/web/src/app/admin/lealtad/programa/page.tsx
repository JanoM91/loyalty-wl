import type { Metadata } from 'next';
import { prisma, programaVigente, versionesDelPrograma, VERSION_TERMINOS } from '@wl/database';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { SubnavLealtad } from '@/components/admin/SubnavLealtad';
import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { CORREO_CONFIGURADO } from '@/lib/correo';
import { fechaLarga } from '@/lib/lealtad/formato';
import { appleWalletConfigurado } from '@/lib/wallet/apple/config';
import { googleWalletConfigurado } from '@/lib/wallet/google/config';
import { FormularioPrograma } from './FormularioPrograma';

export const metadata: Metadata = { title: 'Reglas del programa' };
export const dynamic = 'force-dynamic';

/**
 * Reglas del programa: se ven y se editan aquí.
 *
 * Solo Administración, Dueño y Gerencia. Cada guardado publica una versión
 * nueva; el historial de abajo dice quién cambió qué y cuándo.
 */
export default async function ProgramaPage() {
  const sesion = await exigirRol(ROLES_PROGRAMA);
  const [pendientes, programa, versiones] = await Promise.all([
    prisma.loyaltyAccrual.count({ where: { status: 'PENDIENTE' } }),
    programaVigente(),
    versionesDelPrograma(),
  ]);

  const integraciones = [
    {
      nombre: 'Correo (Resend)',
      listo: CORREO_CONFIGURADO,
      falta: 'RESEND_API_KEY y dominio verificado',
    },
    {
      nombre: 'Fotos de ticket (Vercel Blob)',
      listo: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      falta: 'BLOB_READ_WRITE_TOKEN',
    },
    { nombre: 'Apple Wallet', listo: appleWalletConfigurado(), falta: 'Certificado Pass Type ID' },
    {
      nombre: 'Google Wallet',
      listo: googleWalletConfigurado(),
      falta: 'Cuenta emisora',
    },
    { nombre: 'Lectura del ticket con IA', listo: false, falta: 'Clave de Claude API · fase 2' },
    { nombre: 'WhatsApp', listo: false, falta: 'Meta Tech Provider · fase 2' },
  ];

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad"
      titulo="Programa de lealtad"
      descripcion={`Versión vigente ${programa.version} · términos ${VERSION_TERMINOS}`}
    >
      <SubnavLealtad actual="/admin/lealtad/programa" pendientes={pendientes} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <FormularioPrograma key={programa.version} programa={programa} />

        <div className="grid content-start gap-6">
          <section className="grid content-start gap-3 rounded-lg border border-rule bg-cream p-4">
            <h2 className="font-sans text-base font-semibold text-ink">Reglas fijas</h2>
            <dl className="grid gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Límite</dt>
              <dd>Una visita por cliente, sucursal y día; un ticket una sola vez.</dd>
              <dt className="text-muted">Vencimientos</dt>
              <dd>Sin vencimiento de sellos ni de premios.</dd>
              <dt className="text-muted">Canje</dt>
              <dd>Requiere un contacto verificado; por ahora, el correo.</dd>
            </dl>
          </section>

          <section className="grid content-start gap-3 rounded-lg border border-rule bg-cream p-4">
            <h2 className="font-sans text-base font-semibold text-ink">Historial de versiones</h2>
            <ol className="grid gap-2 text-sm">
              {versiones.map((v) => (
                <li
                  key={v.programa.version}
                  className={`rounded-md border px-3 py-2 ${v.activa ? 'border-ink bg-white' : 'border-rule'}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="font-semibold">{v.programa.version}</b>
                    <span className="text-xs text-muted">
                      {v.activa ? 'Vigente' : 'Anterior'} · {fechaLarga(v.activada ?? v.creada)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {[...v.programa.hitos]
                      .sort((a, b) => a.posicion - b.posicion)
                      .map((h) => `${h.posicion}: ${h.nombre}`)
                      .join(' · ')}
                    {' · '}
                    {v.programa.modalidad === 'VISITA' ? 'por visita' : 'por importe'}
                  </p>
                  {(v.nota || v.creadaPor) && (
                    <p className="mt-1 text-xs text-muted">
                      {v.nota}
                      {v.creadaPor ? ` — ${v.creadaPor}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className="grid content-start gap-3 rounded-lg border border-rule bg-cream p-4">
            <h2 className="font-sans text-base font-semibold text-ink">Integraciones</h2>
            <ul className="grid gap-2 text-sm">
              {integraciones.map((i) => (
                <li
                  key={i.nombre}
                  className="flex items-center justify-between gap-3 rounded-md border border-rule bg-white px-3 py-2"
                >
                  <span>{i.nombre}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.listo ? 'bg-disponible/10 text-disponible' : 'bg-agotado/10 text-agotado'}`}
                  >
                    {i.listo ? 'Activa' : `Pendiente: ${i.falta}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </MarcoPanel>
  );
}
