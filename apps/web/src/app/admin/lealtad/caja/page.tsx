import type { Metadata } from 'next';
import { listarSolicitudesAcceso, operacionesDeHoy, prisma, programaVigente } from '@wl/database';
import { fechaLocal, haceCuanto } from '@wl/domain';

import { MarcoPanel } from '@/components/admin/MarcoPanel';
import { ROLES_CAJA, alcanceSolicitudes, sucursalDeCaja } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { hora } from '@/lib/lealtad/formato';
import { Caja } from './Caja';
import { exigirNegocio } from '@/lib/negocio';
import { estiloDeMarca } from '@/lib/marca';

export const metadata: Metadata = { title: 'Caja' };
export const dynamic = 'force-dynamic';

/**
 * Caja del programa de lealtad: <negocio>.<dominio>/admin/lealtad/caja.
 *
 * Vive dentro del panel a propósito: cada sucursal entra con la cuenta que ya
 * tiene, y la sucursal sale de esa cuenta, no de lo que se escriba en la
 * pantalla.
 */
export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ sucursal?: string; accion?: string; codigo?: string }>;
}) {
  const sesion = await exigirRol(ROLES_CAJA);
  const negocio = await exigirNegocio();
  const { sucursal: pedida, accion, codigo } = await searchParams;
  // Un código de tarjeta para abrir la caja directo en ella (el primer sello
  // del dueño, que tiene la tarjeta y la caja en el mismo celular).
  const codigoInicial = codigo && /^[A-Za-z0-9-]{4,20}$/.test(codigo) ? codigo : undefined;
  // Al elegir sucursal no se pierde lo que se pidió.
  const pedido = new URLSearchParams();
  if (accion) pedido.set('accion', accion);
  if (codigoInicial) pedido.set('codigo', codigoInicial);
  const { sucursal, opciones } = await sucursalDeCaja(sesion, pedida);

  if (!sucursal) {
    return (
      <MarcoPanel
        sesion={sesion}
        actual="/admin/lealtad/caja"
        titulo="Caja"
        enfoque
        descripcion={
          sesion.rol === 'SUCURSAL'
            ? 'Tu cuenta no tiene una sucursal asignada. Pide a administración que la asigne.'
            : '¿En qué sucursal estás atendiendo?'
        }
      >
        <ul className="grid gap-2 sm:grid-cols-3">
          {opciones.map((o) => (
            <li key={o.slug}>
              <a
                href={`/admin/lealtad/caja?sucursal=${o.slug}${pedido.size ? `&${pedido}` : ''}`}
                className="grid gap-1 rounded-lg border border-rule bg-cream p-4 hover:border-ink"
              >
                <b className="font-display text-lg text-ink">{o.nombre}</b>
                <span className="text-xs text-muted">
                  {o.participa ? 'Participa en el programa' : 'Todavía no participa'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </MarcoPanel>
    );
  }

  const alcance = alcanceSolicitudes(sesion);
  const [operaciones, pendientes, programa, solicitudes] = await Promise.all([
    operacionesDeHoy(sucursal.id),
    prisma.loyaltyAccrual.count({ where: { branchId: sucursal.id, status: 'PENDIENTE' } }),
    programaVigente(),
    listarSolicitudesAcceso(alcance),
  ]);
  const ahora = new Date();

  return (
    <MarcoPanel
      sesion={sesion}
      actual="/admin/lealtad/caja"
      titulo="Caja"
      enfoque
      descripcion={sucursal.nombre}
      acciones={
        sesion.rol !== 'SUCURSAL' && opciones.length > 1 ? (
          <a
            href="/admin/lealtad/caja"
            className="text-sm text-crust-dark underline underline-offset-4"
          >
            Cambiar de sucursal
          </a>
        ) : undefined
      }
    >
      <Caja
        sucursal={{ slug: sucursal.slug, nombre: sucursal.nombre, participa: sucursal.participa }}
        hoy={fechaLocal(new Date(), negocio.zonaHoraria)}
        folioObligatorio={negocio.ajustes.comprobanteConQr === 'OBLIGATORIO'}
        sinTicket={negocio.ajustes.comprobanteConQr === 'NO_PEDIR'}
        empezarCon={accion === 'sumar' ? 'visita' : accion === 'premio' ? 'premio' : undefined}
        codigoInicial={codigoInicial}
        empezarConAlta={accion === 'nuevo'}
        empezarConPromo={accion === 'promo'}
        marcaNegocio={{ estilo: estiloDeMarca(negocio), plantilla: negocio.marca.plantilla }}
        fotosActivas={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        pendientes={pendientes}
        programa={programa}
        solicitudes={solicitudes.map((x) => ({
          id: x.id,
          nombre: x.nombre,
          celular: x.celular,
          hace: haceCuanto(x.creada, ahora),
          sucursal: x.sucursal,
        }))}
        verSucursalSolicitudes={alcance.todas}
        cupones={negocio.ajustes.arcade ? { prefijo: negocio.prefijoCodigo } : null}
        operaciones={operaciones.map((o) => ({
          cuando: hora(o.cuando),
          quien: o.quien,
          que: o.que,
          bien: o.bien,
        }))}
      />
    </MarcoPanel>
  );
}
