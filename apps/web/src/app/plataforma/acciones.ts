'use server';

import { cookies, headers } from 'next/headers';
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
  fijarAjustesMensajes,
  fijarBorradoAutomatico,
  fijarFinDePrueba,
  invitarDuenio,
  negocioPorSlug,
  fijarPermisosArcade,
  guardarPlantillaArcade,
  guardarPreciosDelServicio,
  plantillaArcade,
  anularPagoDeClub,
  leerSesionPlataforma,
  registrarPagoDeClub,
  salirPlataforma,
  TOPE_MENSAJES_POR_OMISION,
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

import { anotar } from '@/lib/plataforma/bitacora';
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
  const sesion = await leerSesionPlataforma(r.token);
  if (sesion) await anotar(sesion, 'sesion.entrar');
  redirect('/plataforma');
}

export async function salir(): Promise<void> {
  const galletas = await cookies();
  const token = galletas.get(NOMBRE_COOKIE_PLATAFORMA)?.value;
  const sesion = await leerSesionPlataforma(token);
  if (sesion) await anotar(sesion, 'sesion.salir');
  await salirPlataforma(token);
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
  const sesion = await exigirPlataforma();
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
  await anotar(sesion, 'club.crear', {
    club: r.negocio,
    detalle: { nombre, plan: r.negocio.ajustes.plan, duenio: emailDuenio },
  });
  revalidatePath('/plataforma');
  redirect(
    invitacion.ok
      ? `/plataforma/${slug}?enlace=${encodeURIComponent(invitacion.token)}`
      : `/plataforma/${slug}`,
  );
}

export async function suspender(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (negocio) {
    const activo = form.get('activo') === '1';
    await cambiarEstadoNegocio(negocio.id, activo);
    await anotar(sesion, activo ? 'club.reactivar' : 'club.suspender', { club: negocio });
  }
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio?.slug ?? ''}`);
}

export async function modalidad(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (negocio) {
    const plan = form.get('plan') === 'PRIVADA' ? 'PRIVADA' : 'LITE';
    await cambiarPlan(negocio.id, plan);
    await anotar(sesion, 'club.modalidad', { club: negocio, detalle: { plan } });
  }
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio?.slug ?? ''}`);
}

/** Resultado de un formulario de la ficha que se queda en la misma página. */
export interface EstadoFicha {
  readonly error: string | null;
  readonly listo: string | null;
  /** Enlace de un solo uso para mostrarlo una vez. */
  readonly enlace?: string;
  /**
   * Dirección a la que el navegador va de inmediato (carga completa). Se usa
   * en lugar de `revalidatePath`: repintar la página dentro de la respuesta de
   * la acción a veces se queda colgado (ver la nota sobre `pago`).
   */
  readonly recargar?: string;
}

/**
 * Enlace nuevo de un solo uso para el dueño (por si perdió el anterior). Se
 * muestra ahí mismo: una acción que redirige a la misma página con otros
 * parámetros deja la pantalla sin actualizar en Next 15.
 */
export async function reinvitar(_previo: EstadoFicha, form: FormData): Promise<EstadoFicha> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!negocio) return { error: 'No encontramos el club.', listo: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Escribe el correo del dueño.', listo: null };
  }
  const r = await invitarDuenio(negocio, {
    email,
    nombre: String(form.get('nombre') ?? '').trim() || email,
  });
  if (!r.ok) return { error: r.error, listo: null };
  await anotar(sesion, 'club.invitar_duenio', { club: negocio, detalle: { email } });
  const origen = (await headers()).get('x-wl-origen') ?? '';
  const base = process.env.WL_NEGOCIO_UNICO ? origen : `${origen}/${negocio.slug}`;
  return {
    error: null,
    listo: `Enlace para ${email}. Mándaselo tú: sirve una sola vez y con él elige su contraseña.`,
    enlace: `${base}/admin/contrasena/${r.token}`,
  };
}

/** «extender»: siete días de prueba desde hoy (también sirve de gracia a quien no renovó). */
export async function prueba(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (negocio) {
    const vence = vencimientoDePrueba();
    await fijarFinDePrueba(negocio.id, vence);
    await anotar(sesion, 'club.prueba', {
      club: negocio,
      detalle: { vence, pagadoHastaAntes: negocio.ajustes.pagadoHasta },
    });
  }
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio?.slug ?? ''}`);
}

/** Centavos de un campo en pesos («269», «$2,699.50»); null si no es un importe. */
function centavosDelCampo(form: FormData, campo: string): number | null {
  const t = String(form.get(campo) ?? '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

// Ojo: probado en local (Next 15.5, React 19.3), cuando una acción de servidor
// repinta la misma página (con `redirect` a esa página con otros parámetros o
// con `revalidatePath`), a veces la respuesta no termina de aplicarse: el botón
// se queda en «Registrando…» o la pantalla no cambia, aunque el cambio sí se
// guardó. Por eso estas acciones devuelven `recargar` y el formulario hace una
// carga completa de la página, que siempre funciona.

/**
 * Registra un pago de Lite o del Arcade (un mes o un año) con lo cobrado. El
 * club (o el Arcade) queda pagado hasta el fin del periodo.
 */
export async function pago(_previo: EstadoFicha, form: FormData): Promise<EstadoFicha> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (!negocio) return { error: 'No encontramos el club.', listo: null };
  const concepto = form.get('concepto') === 'ARCADE' ? 'ARCADE' : 'LITE';
  const periodo = form.get('periodo') === 'ANIO' ? 'ANIO' : 'MES';
  const centavos = centavosDelCampo(form, 'importe');
  if (centavos === null) {
    return {
      error: 'Escribe lo cobrado en pesos, por ejemplo 269 (0 si fue cortesía).',
      listo: null,
    };
  }
  const nota = String(form.get('nota') ?? '');
  const r = await registrarPagoDeClub(negocio, { concepto, periodo, centavos, nota }, sesion.email);
  if (!r.ok) return { error: r.error, listo: null };
  await anotar(sesion, 'club.pago', {
    club: negocio,
    detalle: { concepto, periodo, centavos, hasta: r.hasta, pagoId: r.id },
  });
  return {
    error: null,
    listo: 'Pago registrado.',
    recargar: `/plataforma/${negocio.slug}?aviso=${concepto === 'ARCADE' ? 'pago-arcade' : 'pago'}`,
  };
}

/** Anula un pago registrado por error; si es el último, regresa la fecha de pago. */
export async function anularPago(_previo: EstadoFicha, form: FormData): Promise<EstadoFicha> {
  const sesion = await exigirPlataforma();
  const r = await anularPagoDeClub(String(form.get('pago') ?? ''), sesion.email);
  if (!r.ok) return { error: r.error, listo: null };
  await anotar(sesion, 'club.pago_anulado', {
    club: r.pago.clubId ? { id: r.pago.clubId, slug: r.pago.clubSlug } : null,
    detalle: {
      pagoId: r.pago.id,
      concepto: r.pago.concepto,
      centavos: r.pago.centavos,
      revertido: r.revertido,
    },
  });
  const aviso = r.revertido ? 'anulado' : 'anulado-solo';
  const desde = String(form.get('desde') ?? '');
  return {
    error: null,
    listo: 'Pago anulado.',
    recargar:
      desde === 'ingresos'
        ? `/plataforma/ingresos?aviso=${aviso}`
        : `/plataforma/${r.pago.clubSlug}?aviso=${aviso}`,
  };
}

/** Enciende o apaga el borrado automático de clubes con 30 días en pausa. */
export async function borradoAutomatico(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const encendido = form.get('encender') === '1';
  await fijarBorradoAutomatico(encendido, sesion.email);
  await anotar(sesion, 'plataforma.borrado_automatico', { detalle: { encendido } });
  revalidatePath('/plataforma');
  redirect('/plataforma');
}

/**
 * Borra un club y todos sus datos, sin vuelta atrás. Solo clubes en prueba o
 * en pausa (nunca uno pagado o dado de alta por Exkalibur), y solo si quien lo
 * pide escribe su dirección para confirmar.
 */
export async function borrar(_previo: EstadoFicha, form: FormData): Promise<EstadoFicha> {
  const sesion = await exigirPlataforma();
  const slug = String(form.get('slug') ?? '');
  const negocio = await negocioPorSlug(slug);
  if (!negocio) redirect('/plataforma');
  const confirmacion = String(form.get('confirmacion') ?? '')
    .trim()
    .toLowerCase();
  const estado = estadoComercialDe(negocio);
  if (estado === 'ACTIVO') return { error: 'Un club pagado no se borra.', listo: null };
  if (confirmacion !== negocio.slug) {
    return { error: 'No se borró: escribe la dirección exacta del club.', listo: null };
  }
  await borrarNegocio(negocio.id);
  await anotar(sesion, 'club.borrar', {
    club: negocio,
    detalle: { nombre: negocio.nombre, estado },
  });
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
  await anotar(sesion, 'plataforma.precios', {
    detalle: {
      lite: { mes: pesosDelCampo(form, 'lite-mes'), anio: pesosDelCampo(form, 'lite-anio') },
      arcade: { mes: pesosDelCampo(form, 'arcade-mes'), anio: pesosDelCampo(form, 'arcade-anio') },
    },
  });
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
  await anotar(sesion, 'plataforma.plantilla_arcade');
  redirect('/plataforma/ajustes?guardado=plantilla');
}

export async function arcadePermisos(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (!negocio) redirect('/plataforma');
  const actual = negocio.ajustes.arcade ?? (await plantillaArcade());
  await fijarPermisosArcade(negocio.id, permisosDelFormulario(form, actual));
  await anotar(sesion, 'club.arcade_permisos', { club: negocio });
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio.slug}`);
}

/** Enciende o apaga el Arcade sin tocar el periodo pagado. */
export async function arcadeActivo(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (!negocio) redirect('/plataforma');
  const actual = negocio.ajustes.arcade ?? (await plantillaArcade());
  await fijarPermisosArcade(negocio.id, { ...actual, activo: form.get('activo') === '1' });
  await anotar(sesion, 'club.arcade_activo', {
    club: negocio,
    detalle: { activo: form.get('activo') === '1' },
  });
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio.slug}`);
}

/** «Mensajes a clientes»: encender o apagar y fijar el tope mensual del club. */
export async function mensajesAjustes(form: FormData): Promise<void> {
  const sesion = await exigirPlataforma();
  const negocio = await negocioPorSlug(String(form.get('slug') ?? ''));
  if (!negocio) redirect('/plataforma');
  const tope = Number(String(form.get('tope') ?? '').replace(/[^\d]/g, ''));
  const mensajes = {
    activo: form.get('activo') === 'on',
    topeMensual: Number.isFinite(tope) ? tope : TOPE_MENSAJES_POR_OMISION,
  };
  await fijarAjustesMensajes(negocio.id, mensajes);
  await anotar(sesion, 'club.mensajes', { club: negocio, detalle: mensajes });
  revalidatePath('/plataforma');
  redirect(`/plataforma/${negocio.slug}`);
}
