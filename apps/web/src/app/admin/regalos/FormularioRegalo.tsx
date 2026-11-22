'use client';

import { useActionState, useState } from 'react';
import {
  DIAS_REGRESO,
  LIMITES_REGALO,
  VIGENCIAS_REGALO,
  sumarDias,
  type TipoRegalo,
} from '@wl/domain';

import { Alerta } from '@/components/admin/Formulario';
import { textoCorreoRegalo } from '@/lib/regalos';

import { guardarRegalo, probarRegalo, type EstadoRegalo } from './acciones';

const INICIAL: EstadoRegalo = { error: null, aviso: null };

const CAMPO =
  'mt-1.5 w-full rounded-[14px] border-[1.5px] border-[#E8D8C6] bg-white px-3.5 text-[15px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink';

const EJEMPLOS: Record<TipoRegalo, string> = {
  REGRESO: 'Ej. Un café americano',
  CUMPLE: 'Ej. Un postre de cumpleaños',
};

/**
 * Lo que elige el dueño de un regalo automático: encendido, qué regala,
 * cuánto vale y (en «Te extrañamos») a los cuántos días. Debajo, el correo tal
 * como lo recibe su cliente.
 */
export function FormularioRegalo({
  tipo,
  inicial,
  club,
  hoy,
  bloqueo,
}: {
  tipo: TipoRegalo;
  inicial: { activo: boolean; regalo: string; vigencia: number; dias?: number };
  club: string;
  /** "AAAA-MM-DD" en la zona del club, para la vista previa. */
  hoy: string;
  /** Si no se puede encender, por qué. */
  bloqueo: string | null;
}) {
  const [guardado, guardar, guardando] = useActionState(guardarRegalo, INICIAL);
  const [prueba, probar, probando] = useActionState(probarRegalo, INICIAL);
  const [activo, setActivo] = useState(inicial.activo);
  const [regalo, setRegalo] = useState(inicial.regalo);
  const [vigencia, setVigencia] = useState(inicial.vigencia);
  const [dias, setDias] = useState(inicial.dias ?? 30);

  const vista = textoCorreoRegalo({
    tipo,
    nombre: 'Mariana',
    club,
    regalo: regalo.trim() || 'lo que elijas',
    ultimoDia: sumarDias(hoy, vigencia - 1),
  });

  return (
    <form className="grid gap-4">
      <input type="hidden" name="tipo" value={tipo} />
      <label className="flex min-h-[48px] items-center gap-3 text-[15px] font-semibold text-ink">
        <input
          type="checkbox"
          name="activo"
          checked={activo}
          disabled={Boolean(bloqueo) && !activo}
          onChange={(e) => setActivo(e.target.checked)}
          className="h-6 w-6 flex-none accent-ink"
        />
        {activo ? 'Encendido' : 'Apagado'}
      </label>
      {bloqueo && !activo && <Alerta tono="aviso">{bloqueo}</Alerta>}

      {tipo === 'REGRESO' && (
        <label className="text-[14px] font-semibold text-ink">
          Cuando un cliente lleve sin venir
          <select
            name="dias"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className={`${CAMPO} min-h-[48px]`}
          >
            {DIAS_REGRESO.map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="text-[14px] font-semibold text-ink">
        {tipo === 'CUMPLE' ? 'Su regalo de cumpleaños' : 'Su regalo para volver'}
        <input
          name="regalo"
          value={regalo}
          onChange={(e) => setRegalo(e.target.value)}
          maxLength={LIMITES_REGALO.maximo}
          placeholder={EJEMPLOS[tipo]}
          className={`${CAMPO} min-h-[48px]`}
        />
        <span className="mt-1 block text-[12px] font-normal text-muted">
          Algo que tu caja pueda dar sin dudar: un producto o un descuento claro.
        </span>
      </label>

      <label className="text-[14px] font-semibold text-ink">
        Vale por
        <select
          name="vigencia"
          value={vigencia}
          onChange={(e) => setVigencia(Number(e.target.value))}
          className={`${CAMPO} min-h-[48px]`}
        >
          {VIGENCIAS_REGALO.map((v) => (
            <option key={v} value={v}>
              {v} días
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-1.5 rounded-[18px] border-[1.5px] border-dashed border-[#E8D8C6] bg-[#FFFBF5] p-4">
        <span className="text-[12px] font-semibold text-muted">Así le llega el correo</span>
        <b className="text-[15px] text-ink">{vista.asunto}</b>
        {vista.parrafos.map((p) => (
          <p key={p} className="text-[14px] leading-relaxed text-ink-soft">
            {p}
          </p>
        ))}
        <span className="text-[12px] text-muted">
          Con el botón «Ver mi tarjeta» y el enlace para darse de baja.
        </span>
      </div>

      {guardado.error && <Alerta tono="error">{guardado.error}</Alerta>}
      {guardado.aviso && <Alerta tono="ok">{guardado.aviso}</Alerta>}
      {prueba.error && <Alerta tono="error">{prueba.error}</Alerta>}
      {prueba.aviso && <Alerta tono="ok">{prueba.aviso}</Alerta>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          formAction={guardar}
          disabled={guardando || probando}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-cream disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type="submit"
          formAction={probar}
          disabled={guardando || probando}
          className="inline-flex min-h-[48px] items-center justify-center rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink disabled:opacity-50"
        >
          {probando ? 'Enviando prueba…' : 'Mandarme una prueba'}
        </button>
      </div>
    </form>
  );
}
