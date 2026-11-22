'use server';

import { revalidatePath } from 'next/cache';
import { ROLES_USUARIOS, guardarRegalos } from '@wl/database';
import { fechaLocal, leerRegalos, revisarRegalo, sumarDias, type TipoRegalo } from '@wl/domain';

import { exigirRol } from '@/lib/admin/sesion';
import { CORREO_CONFIGURADO, enviarCorreo } from '@/lib/correo';
import { exigirNegocio, origenDeLaPeticion } from '@/lib/negocio';
import { correoRegalo } from '@/lib/regalos';

export interface EstadoRegalo {
  readonly error: string | null;
  readonly aviso: string | null;
}

const tipoDe = (form: FormData): TipoRegalo =>
  form.get('tipo') === 'CUMPLE' ? 'CUMPLE' : 'REGRESO';

/** Enciende, apaga o cambia un regalo automático. Solo quien administra el club. */
export async function guardarRegalo(_previo: EstadoRegalo, form: FormData): Promise<EstadoRegalo> {
  await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  const tipo = tipoDe(form);
  const activo = form.get('activo') === 'on';
  const crudo = String(form.get('regalo') ?? '');
  const r = revisarRegalo(crudo);
  if (activo && !r.ok) return { error: r.error, aviso: null };
  if (activo && tipo === 'REGRESO' && !negocio.ajustes.mensajes?.activo) {
    return {
      error: '«Te extrañamos» llega por correo: primero activa «Mensajes a clientes».',
      aviso: null,
    };
  }

  const actual = negocio.ajustes.regalos;
  const cambio = {
    activo,
    regalo: r.ok ? r.regalo : '',
    vigencia: Number(form.get('vigencia')),
    ...(tipo === 'REGRESO' ? { dias: Number(form.get('dias')) } : {}),
  };
  const nuevos = leerRegalos(
    tipo === 'CUMPLE' ? { ...actual, cumple: cambio } : { ...actual, regreso: cambio },
  );
  await guardarRegalos(negocio.id, nuevos);
  revalidatePath('/admin/regalos');

  if (!activo) return { error: null, aviso: 'Listo. Está apagado: no se dará ningún regalo.' };
  return {
    error: null,
    aviso:
      tipo === 'CUMPLE'
        ? 'Listo. Desde mañana, cada cumpleañero tendrá su regalo en la tarjeta.'
        : `Listo. Desde mañana, quien lleve ${nuevos.regreso.dias} días sin venir recibirá su regalo.`,
  };
}

/** Manda el correo solo al dueño, para que vea cómo les llega. */
export async function probarRegalo(_previo: EstadoRegalo, form: FormData): Promise<EstadoRegalo> {
  const sesion = await exigirRol(ROLES_USUARIOS);
  const negocio = await exigirNegocio();
  const r = revisarRegalo(String(form.get('regalo') ?? ''));
  if (!r.ok) return { error: r.error, aviso: null };
  if (!CORREO_CONFIGURADO)
    return { error: 'El envío de correos todavía no está activo.', aviso: null };
  const vigencia = Number(form.get('vigencia')) || 7;
  const hoy = fechaLocal(new Date(), negocio.zonaHoraria);
  const origen = await origenDeLaPeticion();
  const envio = await enviarCorreo(
    correoRegalo({
      tipo: tipoDe(form),
      para: sesion.email,
      nombre: sesion.nombre,
      club: { nombre: negocio.nombre, domicilio: negocio.marca.legal.domicilio },
      regalo: r.regalo,
      ultimoDia: sumarDias(hoy, vigencia - 1),
      tarjeta: `${origen}/lealtad`,
      baja: null,
      prueba: true,
    }),
  );
  return envio.ok
    ? { error: null, aviso: `Te mandamos la prueba a ${sesion.email}.` }
    : { error: envio.error, aviso: null };
}
