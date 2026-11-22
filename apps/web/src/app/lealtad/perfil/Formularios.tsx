'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import {
  AYUDA_CONTRASENA_NUEVA,
  CampoContrasena,
  UsuarioParaGestor,
} from '@/components/lealtad/CampoContrasena';
import {
  guardarCelular,
  guardarContrasena,
  guardarCorreo,
  guardarPerfil,
  type Estado,
} from '../acciones';

const INICIAL: Estado = { error: null };

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const CAMPO =
  'min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-[#1d1d1f] placeholder:text-[#8a8a8e] text-base focus:border-ink focus:outline-none';

function Boton({ texto, enviando }: { texto: string; enviando: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[48px] w-full items-center justify-center rounded-sm bg-ink px-5 font-semibold text-cream hover:bg-ink-soft disabled:opacity-50"
    >
      {pending ? enviando : texto}
    </button>
  );
}

export function FormularioPerfil(props: {
  nombre: string;
  dia: number | null;
  mes: number | null;
  promociones: boolean;
  medio: 'correo' | 'mensaje';
}) {
  const [estado, accion] = useActionState(guardarPerfil, INICIAL);
  return (
    <form action={accion} className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor="nombre" className="text-sm font-semibold text-ink">
          Nombre <span className="font-normal text-muted">· opcional</span>
        </label>
        <input
          id="nombre"
          name="nombre"
          defaultValue={props.nombre}
          placeholder="¿Cómo te llamamos?"
          className={CAMPO}
          maxLength={120}
        />
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold text-ink">
          Cumpleaños <span className="font-normal text-muted">· opcional, sin año</span>
        </legend>
        <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-2">
          <input
            name="dia"
            aria-label="Día"
            inputMode="numeric"
            placeholder="Día"
            defaultValue={props.dia ?? ''}
            className={CAMPO}
          />
          <select name="mes" aria-label="Mes" defaultValue={props.mes ?? ''} className={CAMPO}>
            <option value="">Mes</option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm leading-snug text-ink-soft">
        <input
          type="checkbox"
          name="promociones"
          defaultChecked={props.promociones}
          className="mt-0.5 h-5 w-5 flex-none accent-ink"
        />
        <span>Quiero recibir promociones y novedades por {props.medio}.</span>
      </label>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      {estado.ok && estado.aviso && <Aviso tono="ok">{estado.aviso}</Aviso>}

      <Boton texto="Guardar" enviando="Guardando…" />
    </form>
  );
}

export function FormularioCorreo({ actual }: { actual: string | null }) {
  const [estado, accion] = useActionState(guardarCorreo, INICIAL);
  return (
    <form action={accion} className="grid gap-2">
      <label htmlFor="correo" className="text-sm font-semibold text-ink">
        {actual ? 'Cambiar mi correo' : 'Agregar mi correo'}
      </label>
      <input
        id="correo"
        name="correo"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="nombre@correo.com"
        className={CAMPO}
      />
      <p className="text-xs text-muted">
        Te mandaremos un código para verificarlo. Verificar es lo que permite canjear premios.
      </p>
      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      <Boton texto={actual ? 'Cambiar y verificar' : 'Agregar y verificar'} enviando="Guardando…" />
    </form>
  );
}

export function FormularioCelular({ actual }: { actual: string | null }) {
  const [estado, accion] = useActionState(guardarCelular, INICIAL);
  return (
    <form action={accion} className="grid gap-2">
      <label htmlFor="celular" className="text-sm font-semibold text-ink">
        {actual ? 'Cambiar mi celular' : 'Agregar mi celular'}
      </label>
      <input
        id="celular"
        name="celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="228 000 0000"
        className={CAMPO}
      />
      <p className="text-xs text-muted">
        Con tu celular la caja puede encontrar tu tarjeta aunque no traigas el código. Se verifica
        cuando abres un enlace que te mandan desde la caja por WhatsApp.
      </p>
      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      {estado.ok && estado.aviso && <Aviso tono="ok">{estado.aviso}</Aviso>}
      <Boton texto={actual ? 'Cambiar celular' : 'Agregar celular'} enviando="Guardando…" />
    </form>
  );
}

/**
 * Contraseña de la tarjeta: crearla (si aún no tiene) o cambiarla pidiendo la
 * actual. Una sola, sirve con el correo y con el celular.
 */
export function FormularioContrasena({
  tiene,
  usuario,
}: {
  tiene: boolean;
  usuario: string | null;
}) {
  // Una sola acción para los dos casos: al crearla, la página se vuelve a
  // pintar con «Cambiar contraseña» y el aviso de éxito no se pierde.
  const [estado, accion] = useActionState(guardarContrasena, INICIAL);
  return (
    <form action={accion} className="grid gap-4" key={tiene ? 'cambiar' : 'crear'}>
      <input type="hidden" name="modo" value={tiene ? 'cambiar' : 'crear'} />
      <UsuarioParaGestor valor={usuario} />
      {tiene && (
        <CampoContrasena
          name="actual"
          etiqueta="Contraseña actual"
          autoComplete="current-password"
        />
      )}
      <CampoContrasena
        name="clave"
        etiqueta={tiene ? 'Contraseña nueva' : 'Tu contraseña'}
        autoComplete="new-password"
        ayuda={AYUDA_CONTRASENA_NUEVA}
      />
      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      {estado.ok && estado.aviso && <Aviso tono="ok">{estado.aviso}</Aviso>}
      <Boton texto={tiene ? 'Cambiar contraseña' : 'Crear contraseña'} enviando="Guardando…" />
    </form>
  );
}
