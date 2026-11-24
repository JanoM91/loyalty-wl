import type { Metadata } from 'next';

import { exigirPlataforma } from '@/lib/plataforma/sesion';

import { MarcoPlataforma } from '../Marco';
import { FormularioNuevo } from './FormularioNuevo';

export const metadata: Metadata = { title: 'Nuevo club' };
export const dynamic = 'force-dynamic';

export default async function NuevoNegocioPage() {
  const sesion = await exigirPlataforma();
  return (
    <MarcoPlataforma
      sesion={sesion}
      actual="nuevo"
      enTarjeta
      titulo="Nuevo club"
      descripcion="Lo mínimo para que opere hoy. El dueño ajusta después su marca, su programa y sus sucursales desde su panel."
    >
      <FormularioNuevo />
    </MarcoPlataforma>
  );
}
