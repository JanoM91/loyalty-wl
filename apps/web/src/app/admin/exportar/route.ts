import {
  ROLES_USUARIOS,
  anotarDescarga,
  clientesParaExportar,
  visitasParaExportar,
} from '@wl/database';

import { contextoPeticion, exigirRol } from '@/lib/admin/sesion';
import { armarCsv, descargaCsv, hoyParaArchivo } from '@/lib/csv';
import { exigirNegocio } from '@/lib/negocio';

export const dynamic = 'force-dynamic';

const ESTADO: Readonly<Record<string, string>> = {
  ACREDITADA: 'Acreditada',
  PENDIENTE: 'Por revisar',
  RECHAZADA: 'Rechazada',
};
const DIAS_VALIDOS = new Set([30, 90, 365]);

/**
 * Descargas para Excel del panel del dueño: `?que=clientes` (tarjetas
 * activas con su contacto, sellos y visitas) o `?que=visitas&dias=90`. Solo
 * para quien administra el club (lleva datos personales de sus clientes) y
 * queda en la bitácora del negocio.
 */
export async function GET(request: Request): Promise<Response> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  const params = new URL(request.url).searchParams;
  const { ip } = await contextoPeticion();
  const zona = negocio.zonaHoraria;
  const prefijo = `${negocio.slug}-${hoyParaArchivo(zona)}`;

  if (params.get('que') === 'visitas') {
    const pedido = Number(params.get('dias'));
    const dias = params.get('dias') === 'todas' ? null : DIAS_VALIDOS.has(pedido) ? pedido : 90;
    const visitas = await visitasParaExportar(dias);
    await anotarDescarga(sesion.userId, 'visitas', visitas.length, ip);
    return descargaCsv(
      `visitas-${prefijo}.csv`,
      armarCsv(
        [
          'Fecha de compra',
          'Registrada',
          'Sucursal',
          'Tarjeta',
          'Cliente',
          'Estado',
          'Folio o ticket',
          'Sellos',
          'Total (MXN)',
          'Registró',
        ],
        visitas.map((v) => [
          v.fechaCompra,
          v.registrada,
          v.sucursal,
          v.codigo,
          v.cliente ?? '',
          ESTADO[v.estado] ?? v.estado,
          v.folio,
          v.sellos,
          v.totalCentavos > 0 ? v.totalCentavos / 100 : '',
          v.registro ?? (v.origen === 'MIGRACION' ? 'Migración de tarjeta física' : ''),
        ]),
      ),
    );
  }

  const clientes = await clientesParaExportar();
  await anotarDescarga(sesion.userId, 'clientes', clientes.length, ip);
  return descargaCsv(
    `clientes-${prefijo}.csv`,
    armarCsv(
      [
        'Tarjeta',
        'Nombre',
        'Celular',
        'Correo',
        'Celular verificado',
        'Correo verificado',
        'Acepta promociones',
        'Sellos en la tarjeta',
        'Vuelta',
        'Visitas',
        'Última visita',
        'Premios por cobrar',
        'Premios entregados',
        'Cumpleaños (día/mes)',
        'Sucursal de alta',
        'Alta',
      ],
      clientes.map((c) => [
        c.codigo,
        c.nombre ?? '',
        c.celular ? `+${c.celular}` : '',
        c.correo ?? '',
        c.celularVerificado,
        c.correoVerificado,
        c.promociones,
        c.sellos,
        c.vuelta,
        c.visitas,
        c.ultimaVisita,
        c.premiosDisponibles,
        c.premiosEntregados,
        c.cumpleanos ?? '',
        c.sucursalDeAlta ?? '',
        c.alta,
      ]),
    ),
  );
}
