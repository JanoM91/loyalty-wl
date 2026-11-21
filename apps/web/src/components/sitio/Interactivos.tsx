'use client';

import { useState } from 'react';

import { Burbuja, IconoSitio, iconoPara } from './Iconos';
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
    juego: '800 puntos: pan dulce de cortesía',
  },
  {
    nombre: 'Barbería',
    premio: 'Corte gratis',
    regla: '6 visitas',
    juego: '5 días jugando: 10 % en el corte',
  },
  {
    nombre: 'Taquería',
    premio: 'Orden de tacos',
    regla: '8 visitas',
    juego: '40 partidas al mes: 2x1 en tacos',
  },
  {
    nombre: 'Spa',
    premio: 'Masaje de 30 min',
    regla: '5 visitas',
    juego: '5 días jugando: 10 % en tu masaje',
  },
  {
    nombre: 'Panadería',
    premio: 'Pan y café',
    regla: '8 visitas',
    juego: '800 puntos: café de cortesía',
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <IconoSitio nombre={iconoPara(g.nombre)} tam={20} />
            {g.nombre}
          </button>
        ))}
      </div>
      <div className="panel grid rise" style={minimo(240, { gap: 28 })} aria-live="polite">
        <div className="row kv" style={{ gap: 14, flexWrap: 'nowrap' }}>
          <Burbuja nombre="regalo" tono="pri" tam={48} />
          <div className="col">
            <span className="sm2">Premio</span>
            <b>{giro.premio}</b>
          </div>
        </div>
        <div className="row kv" style={{ gap: 14, flexWrap: 'nowrap' }}>
          <Burbuja nombre="sello" tam={48} />
          <div className="col">
            <span className="sm2">Se gana con</span>
            <b>{giro.regla}</b>
          </div>
        </div>
        <div className="row kv" style={{ gap: 14, flexWrap: 'nowrap' }}>
          <Burbuja nombre="control" tono="pop" tam={48} />
          <div className="col">
            <span className="sm2">Con Juega y gana</span>
            <b>{giro.juego}</b>
          </div>
        </div>
      </div>
      <span className="sm2">Ejemplos. Tú defines premio y reglas.</span>
    </>
  );
}
