'use client';

import { useState } from 'react';

import { minimo } from './medidas';

/** Tarjeta de ejemplo del inicio: se sella con el botón hasta ganar el premio. */
export function TarjetaDemo() {
  const [estampas, setEstampas] = useState(4);
  const llena = estampas >= 8;
  return (
    <div className="col" style={{ flex: '1 1 360px', minWidth: 0, alignItems: 'center', gap: 18 }}>
      <div className="col toast" aria-live="polite">
        <span className="sm2">Café Demo · ahora</span>
        <b>{llena ? 'Tienes un premio listo' : `Llevas ${estampas} de 8 sellos`}</b>
      </div>
      <div className="col card float">
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="d h3">Café Demo</span>
          <span className="sm2">Tarjeta de ejemplo</span>
        </div>
        <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
          <span className="big">{estampas}</span>
          <span style={{ fontWeight: 600 }}>de 8 sellos</span>
        </div>
        <div className="stamps" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={i < estampas ? 'st on' : 'st'} />
          ))}
        </div>
        <button
          type="button"
          className="btn inv"
          onClick={() => setEstampas(llena ? 0 : estampas + 1)}
        >
          {llena ? 'Canjear premio' : 'Sellar visita'}
        </button>
      </div>
      <span className="sm2">Pruébala: sella una visita</span>
    </div>
  );
}

const EJEMPLOS = [
  {
    nombre: 'Cafetería',
    premio: 'Café gratis',
    regla: '8 visitas',
    juego: 'Reto: 3 visitas en 30 días',
  },
  {
    nombre: 'Barbería',
    premio: 'Corte gratis',
    regla: '6 visitas',
    juego: 'Trae a un amigo: sello para los dos',
  },
  {
    nombre: 'Taquería',
    premio: 'Orden de tacos',
    regla: '8 visitas',
    juego: 'Martes de sello doble',
  },
  {
    nombre: 'Spa',
    premio: 'Masaje de 30 min',
    regla: '5 visitas',
    juego: 'Nivel Oro: prioridad para agendar',
  },
  {
    nombre: 'Panadería',
    premio: 'Pan y café',
    regla: '8 visitas',
    juego: 'Insignia: prueba 3 panes nuevos',
  },
] as const;

/** Selector de giro del inicio: cambia el premio, la regla y la idea de juego. */
export function SelectorGiros() {
  const [elegido, setElegido] = useState(0);
  const giro = EJEMPLOS[elegido] ?? EJEMPLOS[0];
  return (
    <>
      <div className="row" role="group" aria-label="Elige un giro" style={{ gap: 10 }}>
        {EJEMPLOS.map((g, i) => (
          <button
            key={g.nombre}
            type="button"
            className={i === elegido ? 'tab on' : 'tab'}
            aria-pressed={i === elegido}
            onClick={() => setElegido(i)}
          >
            {g.nombre}
          </button>
        ))}
      </div>
      <div className="panel grid rise" style={minimo(240, { gap: 28 })} aria-live="polite">
        <div className="col kv">
          <span className="sm2">Premio</span>
          <b>{giro.premio}</b>
        </div>
        <div className="col kv">
          <span className="sm2">Se gana con</span>
          <b>{giro.regla}</b>
        </div>
        <div className="col kv">
          <span className="sm2">Idea de juego</span>
          <b>{giro.juego}</b>
        </div>
      </div>
      <span className="sm2">Ejemplos. Tú defines premio y reglas.</span>
    </>
  );
}
