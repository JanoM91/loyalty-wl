import {
  enlacePersonalDeTarjeta,
  marcarObjetoGoogle,
  negocioPorSlug,
  obtenerTarjeta,
  programaVigente,
  tieneObjetoGoogle,
} from '@wl/database';

import { urlEnlacePersonal } from '@/lib/lealtad/enlace-personal';
import { urlTarjeta } from '@/lib/lealtad/qr';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';

import { huellaDeDiseno } from '../imagenes';
import { marcaDeImagen, programaDeImagen } from '../negocio';
import { enlaceGuardar, tokenDeAcceso } from './auth';
import { configGoogleWallet, type ConfigGoogleWallet } from './config';
import {
  avisoPorCambio,
  construirClase,
  construirObjeto,
  idObjeto,
  mensajeGoogle,
  type IdentidadGoogle,
  type MensajeGoogle,
  type NegocioGoogle,
  type ObjetoGoogle,
} from './modelo';

/**
 * Llamadas a la API de Google Wallet.
 *
 * Dos operaciones: asegurar que la clase del negocio existe y está al día, y
 * crear o actualizar el objeto (la tarjeta de una persona). Google lleva el
 * cambio a los teléfonos por su cuenta; para que además *avise* (notificación)
 * hay que pedirlo: `notifyPreference` al cambiar el saldo o un mensaje con
 * `TEXT_AND_NOTIFY`. Máximo 3 avisos por pase en 24 h; pasado el límite, el
 * mensaje se guarda sin aviso (`TEXT`).
 *
 * Todo se llama dentro de una petición de un negocio (el botón de la tarjeta,
 * la caja): de ahí salen el negocio y su dirección.
 */

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';

async function llamar(
  config: ConfigGoogleWallet,
  metodo: 'GET' | 'POST' | 'PATCH',
  ruta: string,
  cuerpo?: unknown,
): Promise<{ status: number; texto: string }> {
  const token = await tokenDeAcceso(config);
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, texto: await r.text() };
}

/** El negocio de la petición, como lo necesitan la clase y el objeto. */
async function negocioGoogle(): Promise<{
  negocio: NegocioGoogle;
  programa: Awaited<ReturnType<typeof programaVigente>>;
}> {
  const [dePeticion, origen, programa] = await Promise.all([
    exigirNegocio(),
    origenDeLaPeticion(),
    programaVigente(),
  ]);
  // Se relee: si esta misma petición acaba de cambiar la marca, la copia de la
  // petición todavía trae la anterior.
  const negocio = (await negocioPorSlug(dePeticion.slug)) ?? dePeticion;
  return {
    programa,
    negocio: {
      id: negocio.id,
      nombre: negocio.nombre,
      fondo: negocio.marca.colores.fondo,
      origen,
      huella: huellaDeDiseno(marcaDeImagen(negocio), programaDeImagen(programa)),
    },
  };
}

async function identidad(
  config: ConfigGoogleWallet,
  codigo: string,
  cardId: string,
): Promise<IdentidadGoogle> {
  const personal = await enlacePersonalDeTarjeta(cardId);
  return {
    issuerId: config.issuerId,
    urlQr: await urlTarjeta(codigo),
    urlPersonal: personal ? await urlEnlacePersonal(personal) : null,
  };
}

/** Qué diseño tiene ya Google de cada clase, por instancia del servidor. */
const clasesAlDia = new Map<string, string>();

/**
 * Crea la clase del negocio si no existe y la actualiza si cambió su marca
 * (nombre, color, logotipo). Se comprueba una vez por diseño e instancia.
 */
export async function asegurarClase(config: ConfigGoogleWallet, n: NegocioGoogle): Promise<void> {
  const clase = construirClase(config.issuerId, n);
  if (clasesAlDia.get(clase.id) === n.huella) return;

  const ruta = `/loyaltyClass/${encodeURIComponent(clase.id)}`;
  const existe = await llamar(config, 'GET', ruta);
  if (existe.status === 200) {
    const r = await llamar(config, 'PATCH', ruta, clase);
    if (r.status !== 200) {
      // La clase existe: el pase se puede guardar aunque quede con la marca anterior.
      console.warn(`[wallet] Google no aceptó la clase (${r.status}) ${r.texto.slice(0, 200)}`);
      return;
    }
  } else if (existe.status === 404) {
    const creada = await llamar(config, 'POST', '/loyaltyClass', clase);
    if (creada.status !== 200) {
      throw new Error(
        `Google Wallet: no se pudo crear la clase (${creada.status}) ${creada.texto.slice(0, 200)}`,
      );
    }
  } else {
    throw new Error(
      `Google Wallet: no se pudo leer la clase (${existe.status}) ${existe.texto.slice(0, 200)}`,
    );
  }
  clasesAlDia.set(clase.id, n.huella);
}

async function objetoDeTarjeta(
  config: ConfigGoogleWallet,
  cardId: string,
): Promise<{ objeto: ObjetoGoogle; negocio: NegocioGoogle } | null> {
  const tarjeta = await obtenerTarjeta(cardId);
  if (!tarjeta) return null;
  const { negocio, programa } = await negocioGoogle();
  const objeto = construirObjeto(
    tarjeta,
    negocio,
    await identidad(config, tarjeta.codigo, cardId),
    programa,
  );
  return { objeto, negocio };
}

/**
 * Crea el objeto de la tarjeta (o lo actualiza si ya existe) y devuelve el
 * enlace para guardarlo en Google Wallet. Null si no hay configuración o la
 * tarjeta no existe.
 */
export async function enlaceGoogleWallet(cardId: string): Promise<string | null> {
  const config = configGoogleWallet();
  if (!config) return null;
  const datos = await objetoDeTarjeta(config, cardId);
  if (!datos) return null;
  const { objeto, negocio } = datos;

  await asegurarClase(config, negocio);

  const ruta = `/loyaltyObject/${encodeURIComponent(objeto.id)}`;
  const existente = await llamar(config, 'GET', ruta);
  if (existente.status === 200) {
    const r = await llamar(config, 'PATCH', ruta, objeto);
    if (r.status !== 200) {
      throw new Error(
        `Google Wallet: no se pudo actualizar el objeto (${r.status}) ${r.texto.slice(0, 200)}`,
      );
    }
  } else if (existente.status === 404) {
    const r = await llamar(config, 'POST', '/loyaltyObject', objeto);
    if (r.status !== 200) {
      throw new Error(
        `Google Wallet: no se pudo crear el objeto (${r.status}) ${r.texto.slice(0, 200)}`,
      );
    }
  } else {
    throw new Error(
      `Google Wallet: no se pudo leer el objeto (${existente.status}) ${existente.texto.slice(0, 200)}`,
    );
  }

  await marcarObjetoGoogle(cardId);
  return enlaceGuardar(config, {
    objectId: objeto.id,
    classId: objeto.classId,
    origen: new URL(negocio.origen).origin,
  });
}

/**
 * Lleva el objeto de Google al estado actual de la tarjeta y, si cambió algo
 * que importa (estampa nueva, premio listo), avisa al teléfono. Solo para
 * tarjetas que alguna vez pidieron el pase de Google; nunca lanza.
 */
export async function actualizarObjetoGoogle(cardId: string): Promise<void> {
  const config = configGoogleWallet();
  if (!config) return;
  try {
    if (!(await tieneObjetoGoogle(cardId))) return;
    const datos = await objetoDeTarjeta(config, cardId);
    if (!datos) return;
    const { objeto, negocio } = datos;
    // Si la marca cambió, la clase se pone al día antes que el objeto.
    await asegurarClase(config, negocio).catch((e) =>
      console.warn('[wallet] no se pudo poner al día la clase de Google', e),
    );
    const ruta = `/loyaltyObject/${encodeURIComponent(objeto.id)}`;

    const previo = await llamar(config, 'GET', ruta);
    let anterior: { saldo: string | null; premiosListos: boolean } | null = null;
    if (previo.status === 200) {
      try {
        const o = JSON.parse(previo.texto) as {
          loyaltyPoints?: { balance?: { string?: string } };
          textModulesData?: { id?: string; header?: string }[];
        };
        anterior = {
          saldo: o.loyaltyPoints?.balance?.string ?? null,
          premiosListos: (o.textModulesData ?? []).some(
            (m) => m.id === 'siguiente' && m.header === 'Premios listos',
          ),
        };
      } catch {
        anterior = null;
      }
    }
    const aviso = avisoPorCambio(anterior, objeto);

    const r = await llamar(config, 'PATCH', ruta, {
      ...objeto,
      ...(aviso === 'ESTAMPA' ? { notifyPreference: 'notifyOnUpdate' } : {}),
    });
    if (r.status !== 200) {
      console.warn(
        `[wallet] Google no aceptó la actualización (${r.status}) ${r.texto.slice(0, 200)}`,
      );
      return;
    }
    if (aviso === 'PREMIO') {
      await agregarMensaje(
        config,
        objeto.id,
        mensajeGoogle(
          `premio-${Date.now()}`,
          '¡Tienes un premio listo!',
          'Pídelo en caja en tu próxima visita: muestra tu código.',
          true,
        ),
      );
    }
  } catch (e) {
    console.warn('[wallet] no se pudo actualizar el pase de Google', e);
  }
}

export type ResultadoMensajeGoogle = 'NOTIFICADO' | 'SIN_AVISO' | 'SIN_PASE' | 'FALLO';

/**
 * Agrega un mensaje al objeto. Si Google rechaza el aviso por cuota (3 en 24
 * h), lo deja como texto en el pase, sin notificación.
 */
async function agregarMensaje(
  config: ConfigGoogleWallet,
  objetoId: string,
  m: MensajeGoogle,
): Promise<ResultadoMensajeGoogle> {
  const ruta = `/loyaltyObject/${encodeURIComponent(objetoId)}/addMessage`;
  const r = await llamar(config, 'POST', ruta, { message: m });
  if (r.status === 200) return m.messageType === 'TEXT_AND_NOTIFY' ? 'NOTIFICADO' : 'SIN_AVISO';
  if (r.status === 404) return 'SIN_PASE';
  const cuota = r.status === 429 || /quota/i.test(r.texto);
  if (cuota && m.messageType === 'TEXT_AND_NOTIFY') {
    const sinAviso = await llamar(config, 'POST', ruta, {
      message: { ...m, id: `${m.id}-t`.slice(0, 64), messageType: 'TEXT' },
    });
    return sinAviso.status === 200 ? 'SIN_AVISO' : 'FALLO';
  }
  console.warn(`[wallet] Google no aceptó el mensaje (${r.status}) ${r.texto.slice(0, 200)}`);
  return 'FALLO';
}

/**
 * Mensaje del negocio al pase de Google de una tarjeta, con aviso al teléfono.
 * Queda listo para las campañas (Fase 5); hoy no lo llama ninguna pantalla.
 */
export async function mensajeAlPaseGoogle(
  cardId: string,
  d: { readonly id: string; readonly titulo: string; readonly texto: string },
): Promise<ResultadoMensajeGoogle> {
  const config = configGoogleWallet();
  if (!config) return 'SIN_PASE';
  try {
    if (!(await tieneObjetoGoogle(cardId))) return 'SIN_PASE';
    return await agregarMensaje(
      config,
      idObjeto(config.issuerId, cardId),
      mensajeGoogle(`aviso-${d.id}`, d.titulo, d.texto, true),
    );
  } catch (e) {
    console.warn('[wallet] no se pudo mandar el mensaje a Google', e);
    return 'FALLO';
  }
}
