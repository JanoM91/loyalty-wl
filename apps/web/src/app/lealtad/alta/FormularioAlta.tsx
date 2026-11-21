'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono } from '@/components/lealtad/Iconos';
import { crear, type Estado } from '../acciones';
import { useMarca } from '@/components/Marca';

const INICIAL: Estado = { error: null };

function Enviar({ listo }: { listo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!listo || pending}
      className="inline-flex min-h-[56px] w-full items-center justify-center rounded-sm bg-ink px-6 text-base font-semibold text-cream hover:bg-ink-soft disabled:opacity-40"
    >
      {pending ? 'Creando tu tarjeta…' : 'Crear mi tarjeta'}
    </button>
  );
}

/**
 * Alta de la tarjeta: un dato de contacto y la aceptación de los términos.
 *
 * El nombre y el cumpleaños se piden después, desde el perfil. Cada campo
 * extra en el mostrador es una persona que se queda a medias.
 */
export function FormularioAlta({ sucursal }: { sucursal: string | null }) {
  const marca = useMarca();
  const [estado, accion] = useActionState(crear, INICIAL);
  const [tipo, setTipo] = useState<'celular' | 'correo'>('correo');
  const [contacto, setContacto] = useState('');
  const [terminos, setTerminos] = useState(false);

  const listo = terminos && contacto.trim().length > 5;

  return (
    <form action={accion} className="grid gap-5">
      {sucursal && <input type="hidden" name="sucursal" value={sucursal} />}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-semibold text-ink">¿Cómo te identificamos?</legend>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-cream p-1" role="group">
          {(['correo', 'celular'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => {
                setTipo(t);
                setContacto('');
              }}
              className={`flex min-h-[42px] items-center justify-center gap-2 rounded-sm text-sm font-semibold ${tipo === t ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
            >
              <Icono nombre={t === 'correo' ? 'correo' : 'tarjeta'} width={16} height={16} />
              {t === 'correo' ? 'Correo' : 'Celular'}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <label htmlFor="contacto" className="text-sm font-semibold text-ink">
          {tipo === 'correo' ? 'Tu correo electrónico' : 'Tu número de celular'}
        </label>
        <input
          id="contacto"
          name="contacto"
          required
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          inputMode={tipo === 'correo' ? 'email' : 'tel'}
          autoComplete={tipo === 'correo' ? 'email' : 'tel'}
          placeholder={tipo === 'correo' ? 'nombre@correo.com' : '228 000 0000'}
          className="min-h-[48px] w-full rounded-sm border-[1.5px] border-rule bg-white px-3 text-base focus:border-ink focus:outline-none"
        />
        <p className="text-xs text-muted">
          {tipo === 'correo'
            ? 'Con tu correo podrás verificar tu tarjeta para canjear premios y recuperarla si cambias de celular.'
            : 'Puedes empezar a sumar desde hoy. Para canjear premios, después agrega y verifica un correo.'}
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm leading-snug text-ink-soft">
        <input
          type="checkbox"
          name="terminos"
          checked={terminos}
          onChange={(e) => setTerminos(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-none accent-ink"
        />
        <span>
          Acepto los{' '}
          <a
            href="/lealtad/terminos"
            target="_blank"
            className="text-crust-dark underline underline-offset-2"
          >
            términos del programa
          </a>{' '}
          y leí el{' '}
          <a
            href="/lealtad/privacidad"
            target="_blank"
            className="text-crust-dark underline underline-offset-2"
          >
            aviso de privacidad
          </a>
          .
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm leading-snug text-ink-soft">
        <input
          type="checkbox"
          name="promociones"
          defaultChecked
          className="mt-0.5 h-5 w-5 flex-none accent-ink"
        />
        <span>
          Quiero recibir promociones y novedades de {marca.nombre} por este medio.{' '}
          <span className="text-muted">
            Puedes desactivarlo cuando quieras desde tu perfil; no afecta tus sellos.
          </span>
        </span>
      </label>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      <Enviar listo={listo} />
    </form>
  );
}
