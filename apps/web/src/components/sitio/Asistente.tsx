'use client';

import { useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { COMBINACIONES, girosOrdenados, type CombinacionMarca, type GrupoGiro } from '@wl/domain';

import { crearClub, type EstadoAlta } from '@/app/empezar/acciones';
import { medir } from '@/lib/medicion';

const INICIAL: EstadoAlta = { error: null, paso: null };

/** Mínimo de la contraseña; debe coincidir con `LONGITUD_MINIMA_CONTRASENA`. */
const MINIMO_CLAVE = 10;

const TITULOS = ['Tu negocio', 'Tu premio', 'Tu acceso'] as const;

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
 * Asistente de alta en tres pasos cortos: tu negocio, tu premio y tu acceso.
 * Arriba se arma la tarjeta en vivo. Todos los campos viven en un solo
 * formulario; los pasos que no se ven se ocultan, así el envío lleva todo.
 * `grupo` decide qué giros salen primero; `origen` anota desde qué página llegó.
 */
export function Asistente({ grupo, origen }: { grupo?: GrupoGiro; origen: string }) {
  const giros = useMemo(() => girosOrdenados(grupo), [grupo]);
  const [estado, enviar, enviando] = useActionState(crearClub, INICIAL);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [aviso, setAviso] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);

  const [nombre, setNombre] = useState('');
  const [giroId, setGiroId] = useState(giros[0]!.id);
  const giro = giros.find((g) => g.id === giroId) ?? giros[0]!;
  const [premio, setPremio] = useState(giro.premio);
  const [sellos, setSellos] = useState(giro.sellos);
  const [tocado, setTocado] = useState(false);
  const [combinacionId, setCombinacionId] = useState(giro.combinaciones[0]!);
  const [deFoto, setDeFoto] = useState<string | null>(null);
  const [avisoFoto, setAvisoFoto] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);

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

  // Si el servidor rechaza un dato, se regresa al paso donde se escribe.
  useEffect(() => {
    if (estado.paso) setPaso(estado.paso);
  }, [estado]);

  // Al cambiar de paso, el foco va a su título: el lector de pantalla lo anuncia.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus();
  }, [paso]);

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

  function revisar(n: 1 | 2 | 3): string {
    if (n === 1 && nombre.trim().length < 2) return 'Escribe el nombre de tu negocio.';
    if (n === 2 && premio.trim().length < 2) return 'Escribe el premio de tu tarjeta.';
    if (n === 3) {
      if (whatsapp.replace(/\D/g, '').length < 10) return 'Escribe tu WhatsApp con 10 dígitos.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return 'Escribe un correo válido.';
      if (clave.length < MINIMO_CLAVE)
        return `Tu contraseña necesita al menos ${MINIMO_CLAVE} caracteres.`;
    }
    return '';
  }

  // «Siguiente» y Enter pasan por aquí: en los pasos 1 y 2 avanzan; en el 3
  // el formulario sigue a la acción del servidor.
  function alEnviar(e: FormEvent<HTMLFormElement>) {
    const problema = revisar(paso);
    if (problema) {
      e.preventDefault();
      setAviso(problema);
      return;
    }
    setAviso('');
    if (paso < 3) {
      e.preventDefault();
      medir(paso === 1 ? 'AsistentePaso2' : 'AsistentePaso3', { origen });
      setPaso((paso + 1) as 2 | 3);
    } else {
      medir('Lead', { content_name: origen });
    }
  }

  function atras() {
    setAviso('');
    if (paso > 1) setPaso((paso - 1) as 1 | 2);
  }

  const error = aviso || estado.error;

  return (
    <form
      action={enviar}
      onSubmit={alEnviar}
      // Al corregir un dato, el aviso anterior sobra.
      onChange={() => aviso && setAviso('')}
      noValidate
      className="fm"
    >
      <div className="ap">
        {paso > 1 ? (
          <button type="button" className="atr" onClick={atras} aria-label="Paso anterior">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        <div className="col" style={{ flex: 1, gap: 7 }}>
          <span className="sm2">
            Paso {paso} de 3 · {TITULOS[paso - 1]}
          </span>
          <div className="apb" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= paso ? 'on' : undefined} />
            ))}
          </div>
        </div>
      </div>

      <div
        className="pv"
        style={{ background: elegida.colores.fondo, color: elegida.colores.sobreFondo }}
        aria-hidden="true"
      >
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="d h3">{nombre.trim() || 'Tu negocio'}</span>
          <span className="sm2">Así se verá</span>
        </div>
        {paso > 1 ? (
          <>
            <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
              <span className="big" style={{ fontSize: 64 }}>
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
          </>
        ) : null}
      </div>

      <section className="paso" hidden={paso !== 1} aria-labelledby="alta-t1">
        <h2 id="alta-t1" ref={paso === 1 ? titulo : undefined} tabIndex={-1} className="d h3">
          ¿Cómo se llama tu negocio?
        </h2>
        <input
          id="alta-nombre"
          aria-labelledby="alta-t1"
          name="nombre"
          className="in"
          maxLength={80}
          autoComplete="organization"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <fieldset className="fs">
          <legend className="fl" style={{ marginBottom: 8 }}>
            ¿Qué tipo de negocio es?
          </legend>
          <input type="hidden" name="giro" value={giroId} />
          <div className="gch">
            {giros.map((g) => (
              <button
                key={g.id}
                type="button"
                className="ch"
                aria-pressed={g.id === giroId}
                onClick={() => cambiarGiro(g.id)}
              >
                {g.nombre}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="p" style={{ fontSize: 15 }}>
          Para {giro.nombre.toLowerCase()} te sugerimos{' '}
          <b style={{ color: 'var(--ink)' }}>
            {giro.sellos} sellos y «{giro.premio.toLowerCase()}»
          </b>
          . Lo cambias en el siguiente paso.
        </p>
      </section>

      <section className="paso" hidden={paso !== 2} aria-labelledby="alta-t2">
        <h2 id="alta-t2" ref={paso === 2 ? titulo : undefined} tabIndex={-1} className="d h3">
          ¿Qué gana tu cliente?
        </h2>
        <input
          id="alta-premio"
          aria-labelledby="alta-t2"
          name="premio"
          className="in"
          maxLength={80}
          value={premio}
          onChange={(e) => {
            setTocado(true);
            setPremio(e.target.value);
          }}
        />
        <div className="stp">
          <span id="alta-sellos" className="fl">
            Sellos de visita para ganarlo
          </span>
          <input type="hidden" name="sellos" value={sellos} />
          <div
            role="group"
            aria-labelledby="alta-sellos"
            className="row"
            style={{ gap: 6, flexWrap: 'nowrap', flex: 'none' }}
          >
            <button
              type="button"
              aria-label="Un sello menos"
              disabled={sellos <= 3}
              onClick={() => {
                setTocado(true);
                setSellos(Math.max(3, sellos - 1));
              }}
            >
              −
            </button>
            <span className="stn" aria-live="polite">
              {sellos}
            </span>
            <button
              type="button"
              aria-label="Un sello más"
              disabled={sellos >= 12}
              onClick={() => {
                setTocado(true);
                setSellos(Math.min(12, sellos + 1));
              }}
            >
              +
            </button>
          </div>
        </div>
        <fieldset className="fs">
          <legend className="fl" style={{ marginBottom: 8 }}>
            Color de tu tarjeta
          </legend>
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
          </div>
          <label
            className="tab"
            htmlFor="alta-foto"
            style={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start' }}
          >
            Tomar el color de mi logotipo
          </label>
          <input
            id="alta-foto"
            type="file"
            accept="image/*"
            className="oc"
            onChange={(e) => void leerFoto(e.target.files?.[0])}
          />
          <span className="sm2" aria-live="polite">
            {avisoFoto || 'La foto no se sube: solo leemos su color en tu celular.'}
          </span>
        </fieldset>
      </section>

      <section className="paso" hidden={paso !== 3} aria-labelledby="alta-t3">
        <div className="col" style={{ gap: 4 }}>
          <h2 id="alta-t3" ref={paso === 3 ? titulo : undefined} tabIndex={-1} className="d h3">
            Tu acceso al panel
          </h2>
          <p className="p" style={{ fontSize: 15 }}>
            Con esto entras a tu panel y a tu caja desde cualquier celular.
          </p>
        </div>
        <label className="fl" htmlFor="alta-whatsapp">
          Tu WhatsApp
          <input
            id="alta-whatsapp"
            name="whatsapp"
            className="in"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="10 dígitos"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </label>
        <label className="fl" htmlFor="alta-correo">
          Tu correo
          <input
            id="alta-correo"
            name="correo"
            type="email"
            className="in"
            maxLength={160}
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        <label className="fl" htmlFor="alta-clave">
          Elige una contraseña
          <span className="vk">
            <input
              id="alta-clave"
              name="clave"
              type={verClave ? 'text' : 'password'}
              className="in"
              minLength={MINIMO_CLAVE}
              autoComplete="new-password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              aria-describedby="alta-clave-ayuda"
            />
            <button type="button" onClick={() => setVerClave(!verClave)}>
              {verClave ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
          <span id="alta-clave-ayuda" className="sm2" style={{ fontWeight: 500 }}>
            Mínimo {MINIMO_CLAVE} caracteres. Una frase que recuerdes funciona bien.
          </span>
        </label>
        <p className="p" style={{ fontSize: 14, lineHeight: 1.45 }}>
          Al crear tu club aceptas los{' '}
          <a href="/terminos" target="_blank" className="ul">
            términos del servicio
          </a>
          . Usamos tu WhatsApp y tu correo para operar tu club y avisarte de tu prueba; lee el{' '}
          <a href="/privacidad" target="_blank" className="ul">
            aviso de privacidad
          </a>
          .
        </p>
      </section>

      {/* Campo trampa para robots: oculto a personas y a lectores de pantalla. */}
      <input name="sitio_web" tabIndex={-1} autoComplete="off" className="oc" aria-hidden="true" />
      <input type="hidden" name="origen" value={origen} />

      {error ? (
        <p className="er" role="alert">
          {error}
        </p>
      ) : null}

      {paso < 3 ? (
        <button type="submit" className="btn">
          Siguiente
        </button>
      ) : (
        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? 'Creando tu club…' : 'Crear mi club gratis'}
        </button>
      )}
      <span className="sm2">7 días gratis. Sin tarjeta bancaria.</span>
    </form>
  );
}
