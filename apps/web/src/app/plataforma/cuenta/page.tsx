import type { Metadata } from 'next';
import { sesionesAbiertasPlataforma } from '@wl/database';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { CerrarOtrasSesiones, FormularioMiContrasena } from '../equipo/Formularios';
import { MarcoPlataforma } from '../Marco';
import { Panel } from '../piezas';

export const metadata: Metadata = { title: 'Mi cuenta' };
export const dynamic = 'force-dynamic';

export default async function CuentaPage() {
  const sesion = await exigirPlataforma();
  const abiertas = await sesionesAbiertasPlataforma(sesion.userId);
  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="cuenta"
      titulo="Mi cuenta"
      descripcion={`${sesion.nombre} · ${sesion.email}`}
    >
      <div className="grid gap-5">
        <Panel icono="llave" titulo="Cambiar mi contraseña">
          <p className="mb-4 max-w-prose text-[14px] text-[#5A4F63]">
            Al cambiarla se cierran tus sesiones en otros dispositivos; esta sigue abierta.
          </p>
          <FormularioMiContrasena />
        </Panel>
        <Panel icono="salir" titulo="Sesiones">
          <p className="max-w-prose text-[15px] text-ink">
            Tienes {abiertas} {abiertas === 1 ? 'sesión abierta' : 'sesiones abiertas'}, contando
            esta. Cada sesión dura 12 horas.
          </p>
          <CerrarOtrasSesiones />
        </Panel>
      </div>
    </MarcoPlataforma>
  );
}
