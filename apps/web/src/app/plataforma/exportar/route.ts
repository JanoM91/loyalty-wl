import { headers } from 'next/headers';
import { dueniosDeClubes, listarNegocios, listarPagos, usoDeClubes } from '@wl/database';

import { armarCsv, descargaCsv, hoyParaArchivo } from '@/lib/csv';
import { estadoDelClub } from '@/lib/plataforma/panel';
import { anotar } from '@/lib/plataforma/bitacora';
import { exigirPlataforma } from '@/lib/plataforma/sesion';

export const dynamic = 'force-dynamic';

const ESTADO = {
  activo: 'Activo',
  prueba: 'En prueba',
  pausa: 'En pausa',
  suspendido: 'Suspendido',
};
const fecha = (iso: string | null | undefined) => (iso ? new Date(iso) : null);

/**
 * Descargas del panel de plataforma, en CSV para Excel:
 * `?que=clubes` (por omisión), un renglón por club con su dueño y su uso;
 * `?que=pagos`, los pagos registrados. Llevan datos personales de los
 * dueños: cada descarga queda en la bitácora.
 */
export async function GET(request: Request): Promise<Response> {
  const sesion = await exigirPlataforma();
  const que = new URL(request.url).searchParams.get('que') === 'pagos' ? 'pagos' : 'clubes';

  if (que === 'pagos') {
    const pagos = await listarPagos({ limite: 1000 });
    await anotar(sesion, 'plataforma.exportar', { detalle: { que, renglones: pagos.length } });
    return descargaCsv(
      `pagos-club-lealtad-${hoyParaArchivo()}.csv`,
      armarCsv(
        [
          'Fecha',
          'Club',
          'Dirección',
          'Concepto',
          'Periodo',
          'Importe (MXN, con IVA)',
          'Pagado hasta',
          'Registró',
          'Nota',
          'Anulado',
        ],
        pagos.map((p) => [
          p.fecha,
          p.clubNombre,
          p.clubSlug,
          p.concepto === 'ARCADE' ? 'Juega y gana' : 'Lite',
          p.periodo === 'ANIO' ? 'Año' : 'Mes',
          p.centavos / 100,
          p.hasta,
          p.registro,
          p.nota ?? '',
          p.anulado ? `Sí, por ${p.anulado.quien}` : 'No',
        ]),
      ),
    );
  }

  const negocios = await listarNegocios();
  const ids = negocios.map((f) => f.negocio.id);
  const [duenios, uso] = await Promise.all([dueniosDeClubes(ids), usoDeClubes(ids)]);
  const porClub = new Map<string, { nombre: string; email: string }[]>();
  for (const d of duenios) {
    const lista = porClub.get(d.negocioId) ?? [];
    lista.push({ nombre: d.nombre, email: d.email });
    porClub.set(d.negocioId, lista);
  }
  const origen = (await headers()).get('x-wl-origen') ?? '';
  const ahora = new Date();

  await anotar(sesion, 'plataforma.exportar', { detalle: { que, renglones: negocios.length } });
  return descargaCsv(
    `clubes-club-lealtad-${hoyParaArchivo()}.csv`,
    armarCsv(
      [
        'Club',
        'Dirección',
        'Enlace del club',
        'Estado',
        'Modalidad',
        'Creado',
        'Prueba vence',
        'Pagado hasta',
        'Juega y gana hasta',
        'Sucursales',
        'Tarjetas',
        'Visitas 30 días',
        'Última visita',
        'Último acceso del dueño',
        'Dueño',
        'Correo del dueño',
        'Otros dueños',
        'WhatsApp del alta',
        'Correo del alta',
        'Giro',
        'Llegó desde',
      ],
      negocios.map((f) => {
        const { negocio } = f;
        const a = negocio.ajustes;
        const [principal, ...otros] = porClub.get(negocio.id) ?? [];
        const u = uso.get(negocio.id);
        return [
          negocio.nombre,
          negocio.slug,
          `${origen}/${negocio.slug}`,
          ESTADO[estadoDelClub(f, ahora)],
          a.plan === 'PRIVADA' ? 'Privada' : 'Lite',
          f.creado,
          fecha(a.pruebaVence),
          fecha(a.pagadoHasta),
          fecha(a.arcade?.pagadoHasta),
          f.sucursales,
          f.tarjetas,
          u?.visitas30 ?? 0,
          u?.ultimaVisita ?? null,
          u?.ultimoAcceso ?? null,
          principal?.nombre ?? '',
          principal?.email ?? '',
          otros.map((o) => o.email).join(' / '),
          a.alta?.whatsapp ? `+${a.alta.whatsapp}` : '',
          a.alta?.correo ?? '',
          a.alta?.giro ?? '',
          a.alta?.origen ?? '',
        ];
      }),
    ),
  );
}
