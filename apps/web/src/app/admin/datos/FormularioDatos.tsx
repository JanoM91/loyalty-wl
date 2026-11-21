'use client';

import { useActionState } from 'react';
import type { MarcaNegocio } from '@wl/database';

import { guardarDatos, type EstadoDatos } from './acciones';

const CAMPO =
  'min-h-[48px] w-full border border-rule bg-cream px-3.5 text-[15px] text-ink placeholder:text-muted';

function Campo({
  nombre,
  etiqueta,
  valor,
  nota,
  ejemplo,
  tipo = 'text',
  modo,
}: {
  nombre: string;
  etiqueta: string;
  valor: string;
  nota?: string;
  ejemplo?: string;
  tipo?: string;
  modo?: 'tel' | 'email' | 'url';
}) {
  return (
    <label className="grid gap-1.5 text-[14px] text-muted">
      {etiqueta}
      <input
        name={nombre}
        type={tipo}
        inputMode={modo}
        defaultValue={valor}
        placeholder={ejemplo}
        className={CAMPO}
      />
      {nota ? <span className="text-[13px]">{nota}</span> : null}
    </label>
  );
}

/** Contacto del negocio y datos para términos y privacidad. */
export function FormularioDatos({ marca }: { marca: MarcaNegocio }) {
  const [estado, accion, guardando] = useActionState<EstadoDatos, FormData>(guardarDatos, {
    ok: false,
    error: null,
  });
  return (
    <form action={accion} className="grid max-w-2xl gap-10">
      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Contacto</h2>
        <p className="-mt-2 text-[14px] text-muted">
          Tus clientes lo ven en su tarjeta para escribirte.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            nombre="whatsapp"
            etiqueta="WhatsApp"
            valor={marca.contacto.whatsapp?.replace(/^52/, '') ?? ''}
            ejemplo="Ej. 228 123 4567"
            nota="Diez dígitos. Lo guardamos con el 52 de México."
            tipo="tel"
            modo="tel"
          />
          <Campo
            nombre="correo"
            etiqueta="Correo"
            valor={marca.contacto.correo ?? ''}
            tipo="email"
            modo="email"
          />
          <Campo
            nombre="sitio"
            etiqueta="Sitio web (opcional)"
            valor={marca.contacto.sitio ?? ''}
            ejemplo="https://"
            modo="url"
          />
          <Campo
            nombre="instagram"
            etiqueta="Instagram (opcional)"
            valor={marca.redes.instagram ?? ''}
            ejemplo="Ej. tunegocio"
          />
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl text-ink">Para tus términos y tu aviso de privacidad</h2>
        <p className="-mt-2 max-w-prose text-[14px] text-muted">
          Aparecen en las reglas de tu programa y en tu aviso de privacidad. Son plantillas:
          revísalas con tu abogado antes de abrir el programa al público.
        </p>
        <Campo
          nombre="razonSocial"
          etiqueta="Razón social o tu nombre como persona física"
          valor={marca.legal.razonSocial ?? ''}
        />
        <Campo
          nombre="domicilio"
          etiqueta="Domicilio"
          valor={marca.legal.domicilio ?? ''}
          ejemplo="Calle, número, colonia, ciudad y código postal"
        />
        <Campo
          nombre="correoPrivacidad"
          etiqueta="Correo para dudas y datos personales"
          valor={marca.legal.correoPrivacidad ?? ''}
          tipo="email"
          modo="email"
        />
      </section>

      <div className="grid gap-3">
        {estado.error && (
          <p role="alert" className="border-l-[3px] border-danger px-3 py-2 text-[15px] text-ink">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p
            role="status"
            className="border-l-[3px] border-disponible px-3 py-2 text-[15px] text-ink"
          >
            Listo, guardado.
          </p>
        )}
        <button
          type="submit"
          disabled={guardando}
          className="min-h-[52px] justify-self-start rounded-full bg-ink px-8 text-[16px] font-semibold text-cream disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar datos'}
        </button>
      </div>
    </form>
  );
}
