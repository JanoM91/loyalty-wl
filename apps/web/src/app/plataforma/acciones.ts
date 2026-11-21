'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  NOMBRE_COOKIE_PLATAFORMA,
  borrarNegocio,
  cambiarEstadoNegocio,
  cambiarPlan,
  crearNegocio,
  entrarPlataforma,
  estadoComercialDe,
  fijarBorradoAutomatico,
  fijarFinDePrueba,
  invitarDuenio,
  negocioPorSlug,
  fijarPermisosArcade,
  guardarPlantillaArcade,
  guardarPreciosDelServicio,
  plantillaArcade,
  registrarPago,
  registrarPagoArcade,
  salirPlataforma,
} from '@wl/database';
import {
  COMBINACIONES,
  IDS_JUEGO,
  MODOS_LISTA,
  esPrefijoCodigo,
  esSlugDeNegocio,
  leerPermisosArcade,
  vencimientoDePrueba,
  type PermisosArcade,
} from '@wl/domain';

import { exigirPlataforma, guardarSesionPlataforma } from '@/lib/plataforma/sesion';

export interface EstadoFormulario {
  readonly error: string | null;
  /** El correo tecleado, para no hacerlo escribir otra vez tras un error. */
  readonly email?: string;
}

export async function entrar(_previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const r = await entrarPlataforma(
    String(form.get('email') ?? ''),
    String(form.get('clave') ?? ''),
  );
  if (!r.ok) return { error: r.error, email: String(form.get('email') ?? '').slice(0, 160) };
  await guardarSesionPlataforma(r.token, r.expira);
  redirect('/plataforma');
}

export async function salir(): Promise<void> {
  const galletas = await cookies();
  await salirPlataforma(galletas.get(NOMBRE_COOKIE_PLATAFORMA)?.value);
  galletas.delete({ name: NOMBRE_COOKIE_PLATAFORMA, path: '/plataforma' });
  redirect('/plataforma/entrar');
}

/** "Tacos El Güero" → "tacos-el-guero". */
function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Alta de un negocio en un solo paso: negocio, marca, programa, sucursales y
 * la invitación de su dueño. Al terminar lleva a la ficha, donde está el
 * enlace de un solo uso para que el dueño fije su contraseña.
 */
export async function crear(_previo: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  await exigirPlataforma();
  const t = (k: string) => String(form.get(k) ?? '').trim();

  const nombre = t('nombre');
  const slug = t('slug') ? t('slug').toLowerCase() : aSlug(nombre);
  if (!esSlugDeNegocio(slug))
    return {
      error:
        'La dirección solo lleva minúsculas, números y guiones, y no puede ser una palabra del sitio.',
    };
  const prefijo = t('prefijo').toUpperCase();
  if (!esPrefijoCodigo(prefijo)) return { error: 'El prefijo del código son de 2 a 4 letras.' };

  const posiciones = Number(t('posiciones'));
  if (!Number.isInteger(posiciones) || posiciones < 2 || posiciones > 30)
    return { error: 'La tarjeta lleva entre 2 y 30 sellos.' };
  const premio = t('premio');
  if (premio.length < 2) return { error: 'Escribe el premio de la tarjeta completa.' };
  const intermedio = t('premioIntermedio');
  const posIntermedio = Number(t('posicionIntermedio'));
  if (
    intermedio &&
    (!Number.isInteger(posIntermedio) || posIntermedio < 1 || posIntermedio >= posiciones)
  )
    return { error: 'El premio intermedio va en un sello anterior al último.' };

  const clave = (texto: string) =>
    aSlug(texto).replace(/-/g, '_').toUpperCase().slice(0, 40) || 'PREMIO';
  const hitos = [
    ...(intermedio
      ? [
          {
            posicion: posIntermedio,
            premio: `${clave(intermedio)}_${posIntermedio}`,
            nombre: intermedio,
            incluye: '',
          },
        ]
      : []),
    {
      posicion: posiciones,
      premio: `${clave(premio)}_${posiciones}`,
      nombre: premio,
      incluye: t('premioIncluye'),
    },
  ];

  const sucursales = t('sucursales')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);
  if (sucursales.length === 0) return { error: 'Escribe al menos una sucursal, una por renglón.' };
  const slugsSucursal = new Set<string>();
  for (const s of sucursales) {
    const ss = aSlug(s);
    if (!ss || slugsSucursal.has(ss))
      return { error: `Revisa las sucursales: «${s}» está repetida o vacía.` };
    slugsSucursal.add(ss);
  }

  const emailDuenio = t('duenioEmail').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDuenio))
    return { error: 'Escribe el correo del dueño.' };
  const combinacion = COMBINACIONES.find((c) => c.id === t('combinacion')) ?? COMBINACIONES[0]!;

  const r = await crearNegocio({
    slug,
    nombre,
    prefijoCodigo: prefijo,
    zonaHoraria: t('zona') || undefined,
    marca: { plantilla: combinacion.plantilla, colores: combinacion.colores, frase: t('frase') },
    ajustes: { plan: t('plan') === 'PRIVADA' ? 'PRIVADA' : 'LITE' },
    programa: { posiciones, modalidad: 'VISITA', hitos, tramos: [], ventanaContingenciaDias: 2 },
    sucursales: sucursales.map((s) => ({ slug: aSlug(s), nombre: s, participa: true })),
  });
  if (!r.ok) return { error: r.error };

  const invitacion = await invitarDuenio(r.negocio, {
    email: emailDuenio,
    nombre: t('duenioNombre') || emailDuenio,
  });
  revalidatePath('/plataforma');
  redirect(
    invitacion.ok
      ? `/plataforma/${slug}?enlace=${encodeURIComponent(invitacion.token)}`
      : `/plataforma/${slug}`,
  );
}

export async function suspender(form: FormData): Promise<void> {
  await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (negocio) await cambiarEstadoNegocio(negocio.id, form.get('activo') === '1');
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio?.slug ?? ''}`);
}

export async function modalidad(form: FormData): Promise<void> {
  await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (negocio) await cambiarPlan(negocio.id, form.get('plan') === 'PRIVADA' ? 'PRIVADA' : 'LITE');
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio?.slug ?? ''}`);
}

/** Enlace nuevo de un solo uso para el dueño (por si perdió el anterior). */
export async function reinvitar(form: FormData): Promise<void> {
  await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!negocio || !email) redirect('/plataforma');
  const r = await invitarDuenio(negocio, {
    email,
    nombre: String(form.get('nombre') ?? '').trim() || email,
  });
  redirect(
    r.ok
      ? `/plataforma/${negocio.slug}?enlace=${encodeURIComponent(r.token)}`
      : `/plataforma/${negocio.slug}`,
  );
}

/** «extender»: siete días de prueba desde hoy (también sirve de gracia a quien no renovó). */
export async function prueba(form: FormData): Promise<void> {
  await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (negocio) await fijarFinDePrueba(negocio.id, vencimientoDePrueba());
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio?.slug ?? ''}`);
}

/** Registra el pago de un mes o un año: el club queda activo hasta el fin del periodo. */
export async function pago(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (negocio) {
    const periodo = form.get('periodo') === 'ANIO' ? 'ANIO' : 'MES';
    const hasta = await registrarPago(negocio, periodo);
    console.warn(`[pago] ${negocio.slug}: ${periodo} hasta ${hasta} (registró ${sesion.email})`);
  }
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio?.slug ?? ''}`);
}

/** Enciende o apaga el borrado automático de clubes con 30 días en pausa. */
export async function borradoAutomatico(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  await fijarBorradoAutomatico(form.get('encender') === '1', sesion.email);
  revalidatePath('/plataforma');
  redirect('/plataforma');
}

/**
 * Borra un club y todos sus datos, sin vuelta atrás. Solo clubes en prueba o
 * en pausa (nunca uno pagado o dado de alta por Exkalibur), y solo si quien lo
 * pide escribe su dirección para confirmar.
 */
export async function borrar(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const slug = String(form.get('slug') ?? '');
  const negocio = await negocioPorSlug(slug);
  if (!negocio) redirect('/plataforma');
  const confirmacion = String(form.get('confirmacion') ?? '')
    .trim()
    .toLowerCase();
  const estado = estadoComercialDe(negocio);
  if (confirmacion !== negocio.slug || estado === 'ACTIVO') {
    redirect(`/plataforma/${negocio.slug}?borrar=no`);
  }
  await borrarNegocio(negocio.id);
  console.warn(`[borrado] ${negocio.slug} (${estado}) borrado a mano por ${sesion.email}`);
  revalidatePath('/plataforma');
  revalidatePath('/negocios');
  redirect(`/plataforma?borrado=${encodeURIComponent(negocio.slug)}`);
}

// ---------------------------------------------------------------------------
// Precios y Arcade
// ---------------------------------------------------------------------------

/** Pesos enteros, o null si el campo quedó vacío («sin precio publicado»). */
function pesosDelCampo(form: FormData, campo: string): number | null {
  const t = String(form.get(campo) ?? '').replace(/[$,\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export async function guardarPrecios(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  await guardarPreciosDelServicio(
    {
      lite: { mes: pesosDelCampo(form, 'lite-mes'), anio: pesosDelCampo(form, 'lite-anio') },
      arcade: { mes: pesosDelCampo(form, 'arcade-mes'), anio: pesosDelCampo(form, 'arcade-anio') },
    },
    sesion.email,
  );
  console.warn(`[precios] actualizados por ${sesion.email}`);
  revalidatePath('/', 'layout');
  redirect('/plataforma/ajustes?guardado=precios');
}

/** Permisos del Arcade tal como vienen del formulario (ver FormPermisos). */
function permisosDelFormulario(form: FormData, base: PermisosArcade): PermisosArcade {
  const numero = (campo: string) => Number(form.get(campo));
  return (
    leerPermisosArcade({
      ...base,
      juegos: IDS_JUEGO.filter((j) => form.get(`juego-${j}`) === 'on'),
      maxJuegosActivos: numero('maxJuegosActivos'),
      maxPartidasDia: numero('maxPartidasDia'),
      maxRetos: numero('maxRetos'),
      listas: MODOS_LISTA.filter((m) => form.get(`lista-${m}`) === 'on'),
      edicionRetos: String(form.get('edicionRetos') ?? 'todo'),
    }) ?? base
  );
}

export async function guardarPlantilla(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  await guardarPlantillaArcade(permisosDelFormulario(form, await plantillaArcade()), sesion.email);
  redirect('/plataforma/ajustes?guardado=plantilla');
}

export async function arcadePermisos(form: FormData): Promise<void> {
  await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (!negocio) redirect('/plataforma');
  const actual = negocio.ajustes.arcade ?? (await plantillaArcade());
  await fijarPermisosArcade(negocio.id, permisosDelFormulario(form, actual));
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio.slug}#arcade`);
}

/** Registra el pago del Arcade (un mes o un año) y lo activa. */
export async function arcadePago(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (!negocio) redirect('/plataforma');
  const periodo = form.get('periodo') === 'ANIO' ? 'ANIO' : 'MES';
  const hasta = await registrarPagoArcade(negocio, periodo);
  console.warn(`[arcade] ${negocio.slug}: ${periodo} hasta ${hasta} (registró ${sesion.email})`);
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio.slug}#arcade`);
}

/** Enciende o apaga el Arcade sin tocar el periodo pagado. */
export async function arcadeActivo(form: FormData): Promise<void> {
  await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (!negocio) redirect('/plataforma');
  const actual = negocio.ajustes.arcade ?? (await plantillaArcade());
  await fijarPermisosArcade(negocio.id, { ...actual, activo: form.get('activo') === '1' });
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio.slug}#arcade`);
}
