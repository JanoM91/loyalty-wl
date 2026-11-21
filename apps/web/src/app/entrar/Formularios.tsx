'use client';

import { useActionState, useState } from 'react';

import {
  entrarDesdeElSitio,
  recuperarDesdeElSitio,
  type EstadoEntrar,
  type EstadoRecuperarSitio,
} from './acciones';

/** Correo y contraseña; entra al panel del club de ese correo. */
export function FormularioEntrar() {
  const [estado, accion, entrando] = useActionState<EstadoEntrar, FormData>(entrarDesdeElSitio, {
    error: null,
  });
  const [ver, setVer] = useState(false);
  return (
    <form action={accion} className="fm">
      <label className="fl" htmlFor="entrar-correo">
        Tu correo
        <input
          id="entrar-correo"
          name="correo"
          type="email"
          className="in"
          autoComplete="email"
          required
        />
      </label>
      <label className="fl" htmlFor="entrar-clave">
        Tu contraseña
        <span className="vk">
          <input
            id="entrar-clave"
            name="clave"
            type={ver ? 'text' : 'password'}
            className="in"
            autoComplete="current-password"
            required
          />
          <button type="button" onClick={() => setVer(!ver)}>
            {ver ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
      </label>
      {estado.error ? (
        <p className="er" role="alert">
          {estado.error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={entrando}>
        {entrando ? 'Entrando…' : 'Entrar a mi panel'}
      </button>
      <a
        href="/entrar/recuperar"
        className="ul"
        style={{ alignSelf: 'flex-start', fontWeight: 600 }}
      >
        Olvidé mi contraseña
      </a>
    </form>
  );
}

/** Pide el enlace para elegir una contraseña nueva. */
export function FormularioRecuperar({ whatsapp, minutos }: { whatsapp: string; minutos: number }) {
  const [estado, accion, enviando] = useActionState<EstadoRecuperarSitio, FormData>(
    recuperarDesdeElSitio,
    { error: null, enviado: false },
  );
  if (estado.enviado) {
    return (
      <div className="fm" role="status">
        <b style={{ fontSize: 18 }}>Revisa tu correo</b>
        <p className="p" style={{ fontSize: 16 }}>
          Si ese correo tiene un club y ya lo confirmaste, en unos minutos te llega un enlace para
          elegir una contraseña nueva. Vence en {minutos} minutos.
        </p>
        <p className="p" style={{ fontSize: 16 }}>
          ¿No te llegó? Escríbenos y te mandamos el enlace por WhatsApp.
        </p>
        <a href={whatsapp} className="btn" target="_blank" rel="noopener noreferrer">
          Pedir ayuda por WhatsApp
        </a>
      </div>
    );
  }
  return (
    <form action={accion} className="fm">
      <label className="fl" htmlFor="recuperar-correo">
        El correo con el que entras
        <input
          id="recuperar-correo"
          name="correo"
          type="email"
          className="in"
          autoComplete="email"
          required
        />
      </label>
      {estado.error ? (
        <p className="er" role="alert">
          {estado.error}
        </p>
      ) : null}
      <button type="submit" className="btn" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Mandarme un enlace'}
      </button>
      <p className="p" style={{ fontSize: 15 }}>
        ¿Prefieres que te ayudemos?{' '}
        <a href={whatsapp} className="ul" target="_blank" rel="noopener noreferrer">
          Escríbenos por WhatsApp
        </a>
        .
      </p>
    </form>
  );
}
