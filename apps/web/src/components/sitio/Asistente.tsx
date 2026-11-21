'use client';

import { useActionState, useMemo, useState } from 'react';
import { COMBINACIONES, girosOrdenados, type CombinacionMarca, type GrupoGiro } from '@wl/domain';

import { crearClub, type EstadoAlta } from '@/app/empezar/acciones';

const INICIAL: EstadoAlta = { error: null };

function aRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Color dominante de una imagen: promedio de sus píxeles con más color. */
async function colorDeLaFoto(archivo: File): Promise<[number, number, number] | null> {
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = new Image();
    imagen.src = url;
    await imagen.decode();
    const lado = 48;
    const lienzo = document.createElement('canvas');
    lienzo.width = lado;
    lienzo.height = lado;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(imagen, 0, 0, lado, lado);
    const px = ctx.getImageData(0, 0, lado, lado).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let peso = 0;
    for (let i = 0; i < px.length; i += 4) {
      const [pr, pg, pb, pa] = [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
      if (pa < 128) continue;
      const max = Math.max(pr, pg, pb);
      const min = Math.min(pr, pg, pb);
      // Los píxeles casi blancos, casi negros o grises pesan muy poco.
      const w = (max - min) / 255 + 0.02;
      r += pr * w;
      g += pg * w;
      b += pb * w;
      peso += w;
    }
    return peso > 0 ? [r / peso, g / peso, b / peso] : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** La combinación cuyo color de tarjeta se parece más al color dado. */
function combinacionCercana(color: [number, number, number]): CombinacionMarca {
  let mejor = COMBINACIONES[0]!;
  let distancia = Infinity;
  for (const c of COMBINACIONES) {
    const [r, g, b] = aRgb(c.colores.fondo);
    const d = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
    if (d < distancia) {
      distancia = d;
      mejor = c;
    }
  }
  return mejor;
}

/**
 * Asistente de alta: cinco datos y un color, y el club queda creado en prueba.
 * `grupo` decide qué giros salen primero; `origen` anota desde qué página llegó.
 */
export function Asistente({ grupo, origen }: { grupo?: GrupoGiro; origen: string }) {
  const giros = useMemo(() => girosOrdenados(grupo), [grupo]);
  const [estado, enviar, enviando] = useActionState(crearClub, INICIAL);

  const [nombre, setNombre] = useState('');
  const [giroId, setGiroId] = useState(giros[0]!.id);
  const giro = giros.find((g) => g.id === giroId) ?? giros[0]!;
  const [premio, setPremio] = useState(giro.premio);
  const [sellos, setSellos] = useState(giro.sellos);
  const [tocado, setTocado] = useState(false);
  const [combinacionId, setCombinacionId] = useState(giro.combinaciones[0]!);
  const [deFoto, setDeFoto] = useState<string | null>(null);
  const [avisoFoto, setAvisoFoto] = useState('');

  const opciones = giro.combinaciones
    .map((id) => COMBINACIONES.find((c) => c.id === id))
    .filter((c): c is CombinacionMarca => Boolean(c));
  const elegida =
    COMBINACIONES.find((c) => c.id === combinacionId) ?? opciones[0] ?? COMBINACIONES[0]!;

  // La combinación tomada de la foto, si no está ya entre las seis del giro.
  const extra =
    deFoto && !opciones.some((c) => c.id === deFoto)
      ? (COMBINACIONES.find((c) => c.id === deFoto) ?? null)
      : null;

  function cambiarGiro(id: string) {
    const nuevo = giros.find((g) => g.id === id);
    if (!nuevo) return;
    setGiroId(id);
    // Mientras el dueño no haya escrito su premio, se propone el del giro.
    if (!tocado) {
      setPremio(nuevo.premio);
      setSellos(nuevo.sellos);
    }
    if (!deFoto) setCombinacionId(nuevo.combinaciones[0]!);
  }

  async function leerFoto(archivo: File | undefined) {
    if (!archivo) return;
    const color = await colorDeLaFoto(archivo);
    if (!color) {
      setAvisoFoto('No pudimos leer esa imagen. Elige un color de la lista.');
      return;
    }
    const c = combinacionCercana(color);
    setDeFoto(c.id);
    setCombinacionId(c.id);
    setAvisoFoto(`Tomamos «${c.nombre}» de tu foto.`);
  }

  return (
    <form action={enviar} className="fm">
      <div
        className="pv"
        style={{ background: elegida.colores.fondo, color: elegida.colores.sobreFondo }}
        aria-hidden="true"
      >
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="d h3">{nombre.trim() || 'Tu negocio'}</span>
          <span className="sm2">Así se verá</span>
        </div>
        <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
          <span className="big" style={{ fontSize: 72 }}>
            1
          </span>
          <span style={{ fontWeight: 600 }}>de {sellos} sellos</span>
        </div>
        <div className="pvs">
          {Array.from({ length: sellos }, (_, i) => (
            <span
              key={i}
              className="pvd"
              style={
                i === 0
                  ? { background: elegida.colores.acento, borderColor: elegida.colores.acento }
                  : undefined
              }
            />
          ))}
        </div>
        <span style={{ fontWeight: 600 }}>{premio.trim() || giro.premio}</span>
      </div>

      <label className="fl" htmlFor="alta-nombre">
        Nombre de tu negocio
        <input
          id="alta-nombre"
          name="nombre"
          className="in"
          required
          maxLength={80}
          autoComplete="organization"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <label className="fl" htmlFor="alta-giro">
        Giro
        <select
          id="alta-giro"
          name="giro"
          className="in"
          value={giroId}
          onChange={(e) => cambiarGiro(e.target.value)}
        >
          {giros.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
      </label>

      <div className="fr">
        <label className="fl" htmlFor="alta-premio" style={{ flex: '3 1 220px' }}>
          Premio
          <input
            id="alta-premio"
            name="premio"
            className="in"
            required
            maxLength={80}
            value={premio}
            onChange={(e) => {
              setTocado(true);
              setPremio(e.target.value);
            }}
          />
        </label>
        <label className="fl" htmlFor="alta-sellos" style={{ flex: '1 1 110px' }}>
          Sellos
          <select
            id="alta-sellos"
            name="sellos"
            className="in"
            value={sellos}
            onChange={(e) => {
              setTocado(true);
              setSellos(Number(e.target.value));
            }}
          >
            {[3, 4, 5, 6, 7, 8, 9, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="fs">
        <legend className="fl">Color de tu tarjeta</legend>
        <div className="sws">
          {[...opciones, ...(extra ? [extra] : [])].map((c) => (
            <label key={c.id} className="sw" title={c.nombre}>
              <input
                type="radio"
                name="combinacion"
                value={c.id}
                checked={c.id === combinacionId}
                onChange={() => setCombinacionId(c.id)}
              />
              <span
                style={{ background: c.colores.fondo, borderColor: c.colores.acento }}
                aria-hidden="true"
              />
              <span className="oc">{c.nombre}</span>
            </label>
          ))}
          <label
            className="tab"
            htmlFor="alta-foto"
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            Usar mi logotipo
          </label>
          <input
            id="alta-foto"
            type="file"
            accept="image/*"
            className="oc"
            onChange={(e) => void leerFoto(e.target.files?.[0])}
          />
        </div>
        <span className="sm2" aria-live="polite">
          {avisoFoto || 'La foto no se sube: solo se lee su color en tu teléfono.'}
        </span>
      </fieldset>

      <div className="fr">
        <label className="fl" htmlFor="alta-whatsapp" style={{ flex: '1 1 200px' }}>
          Tu WhatsApp
          <input
            id="alta-whatsapp"
            name="whatsapp"
            className="in"
            required
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="10 dígitos"
          />
        </label>
        <label className="fl" htmlFor="alta-correo" style={{ flex: '1 1 200px' }}>
          Tu correo
          <input
            id="alta-correo"
            name="correo"
            type="email"
            className="in"
            required
            maxLength={160}
            autoComplete="email"
          />
        </label>
      </div>

      {/* Campo trampa para robots: oculto a personas y a lectores de pantalla. */}
      <input name="sitio_web" tabIndex={-1} autoComplete="off" className="oc" aria-hidden="true" />
      <input type="hidden" name="origen" value={origen} />

      {estado.error ? (
        <p className="er" role="alert">
          {estado.error}
        </p>
      ) : null}

      <button type="submit" className="btn" disabled={enviando}>
        {enviando ? 'Creando tu club…' : 'Crear mi club gratis'}
      </button>
      <span className="sm2">7 días gratis. Sin tarjeta bancaria.</span>
    </form>
  );
}
