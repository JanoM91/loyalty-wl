'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { guardarPrograma, prisma } from '@wl/database';
import { clavePremioDesdeNombre, type Hito, type Tramo } from '@wl/domain';

import { ROLES_PROGRAMA } from '@/lib/admin/lealtad';
import { exigirRol } from '@/lib/admin/sesion';
import { avisarCambioDeTarjeta } from '@/lib/wallet/avisar';

/**
 * Guardar una versión nueva del programa desde el panel.
 *
 * Quién puede: Administración, Dueño y Gerencia (`ROLES_PROGRAMA`). La caja
 * de sucursal ni siquiera ve esta pantalla.
 *
 * Lo que llega del formulario se arma como `ProgramaLealtad` y lo valida el
 * dominio; los errores vuelven en lenguaje del negocio. Al guardar, los pases
 * de Wallet de todas las tarjetas se marcan para regenerarse (lo hace la base)
 * y aquí se avisa a los teléfonos, en segundo plano.
 */

export interface EstadoPrograma {
  readonly ok: boolean;
  readonly problemas: readonly string[];
  readonly version?: string;
}

function entero(v: FormDataEntryValue | null, porOmision = NaN): number {
  const s = String(v ?? '').trim();
  if (s === '') return porOmision;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
}

/** "185.50" → 18550. Vacío → null (sin tope). */
function centavos(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '')
    .replace(/[$,\s]/g, '')
    .trim();
  if (s === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

export async function guardar(_previo: EstadoPrograma, form: FormData): Promise<EstadoPrograma> {
  const sesion = await exigirRol(ROLES_PROGRAMA);

  const hitos: Hito[] = [];
  for (let i = 0; i < 6; i++) {
    const nombre = String(form.get(`hito-${i}-nombre`) ?? '').trim();
    const posicionTexto = String(form.get(`hito-${i}-posicion`) ?? '').trim();
    if (nombre === '' && posicionTexto === '') continue;
    const claveAnterior = String(form.get(`hito-${i}-clave`) ?? '').trim();
    const nombreAnterior = String(form.get(`hito-${i}-nombre-anterior`) ?? '').trim();
    hitos.push({
      posicion: entero(posicionTexto),
      // La clave se conserva si el nombre no cambió; si cambió, es un premio
      // distinto y lleva clave nueva, para que lo ya ganado no se confunda.
      premio:
        claveAnterior && nombreAnterior === nombre ? claveAnterior : clavePremioDesdeNombre(nombre),
      nombre: nombre.slice(0, 80),
      incluye: String(form.get(`hito-${i}-incluye`) ?? '')
        .trim()
        .slice(0, 200),
    });
  }

  const tramos: Tramo[] = [];
  for (let i = 0; i < 8; i++) {
    const desde = String(form.get(`tramo-${i}-desde`) ?? '').trim();
    const estampas = String(form.get(`tramo-${i}-estampas`) ?? '').trim();
    if (desde === '' && estampas === '') continue;
    const d = centavos(desde);
    const h = centavos(form.get(`tramo-${i}-hasta`));
    tramos.push({
      desdeCentavos: d === null ? 0 : d,
      hastaCentavos: h,
      estampas: entero(estampas),
    });
  }

  const modalidad = form.get('modalidad') === 'IMPORTE' ? 'IMPORTE' : 'VISITA';

  const r = await guardarPrograma(
    {
      posiciones: entero(form.get('posiciones')),
      hitos,
      modalidad,
      tramos,
      ventanaContingenciaDias: entero(form.get('ventana')),
    },
    { usuarioId: sesion.userId, nota: String(form.get('nota') ?? '') },
  );
  if (!r.ok) return { ok: false, problemas: r.problemas };

  revalidatePath('/admin/lealtad', 'layout');
  revalidatePath('/lealtad', 'layout');

  // Los pases muestran los premios; se les avisa sin detener la respuesta.
  after(() => avisarATodosLosPases());

  return { ok: true, problemas: [], version: r.version };
}

async function avisarATodosLosPases(): Promise<void> {
  try {
    const tarjetas = await prisma.loyaltyCard.findMany({
      where: {
        isActive: true,
        OR: [{ walletRegistrations: { some: {} } }, { googleWalletObjectAt: { not: null } }],
      },
      select: { id: true },
      take: 2000,
    });
    for (const t of tarjetas) await avisarCambioDeTarjeta(t.id);
  } catch (e) {
    console.warn('No se pudo avisar a los pases del cambio de programa', e);
  }
}
