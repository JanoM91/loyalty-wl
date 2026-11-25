'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { COMBINACIONES, girosOrdenados, type CombinacionMarca, type GrupoGiro } from '@wl/domain';

import { crearClub, type EstadoAlta } from '@/app/empezar/acciones';
import { ImagenIlegible, prepararLogo, type LogoPreparado } from '@/lib/logo-en-navegador';
import { medir } from '@/lib/medicion';
import { recargarAlTerminar } from '@/lib/recargar-al-terminar';

const INICIAL: EstadoAlta = { error: null, paso: null };

// Club creado: se abre la pantalla final con una carga completa en cuanto
// llega la respuesta (ver `recargarAlTerminar`). Antes, a veces el dueño se
// quedaba en «Creando tu club…» aunque el club ya existía.
const crearYAbrir = recargarAlTerminar(crearClub, (e) => e.listo);

/** Mínimo de la contraseña; debe coincidir con `LONGITUD_MINIMA_CONTRASENA`. */
const MINIMO_CLAVE = 10;

const TITULOS = ['Tu negocio', 'Tu premio', 'Tu acceso'] as const;

/** El logotipo ya preparado en el celular, con sus vistas previas. */
type LogoListo = LogoPreparado & { readonly vista: string; readonly vistaSello: string };

/** Nombre de archivo según el formato que salió al preparar la imagen. */
const nombreDeLogo = (b: Blob) => (b.type === 'image/png' ? 'logo.png' : 'logo.jpg');

/**
 * Asistente de alta en tres pasos cortos: tu negocio, tu premio y tu acceso.
 * Arriba se arma la tarjeta en vivo. Todos los campos viven en un solo
 * formulario; los pasos que no se ven se ocultan, así el envío lleva todo.
 * `grupo` decide qué giros salen primero; `origen` anota desde qué página llegó.
 */
export function Asistente({ grupo, origen }: { grupo?: GrupoGiro; origen: string }) {
  const giros = useMemo(() => girosOrdenados(grupo), [grupo]);
  const [estado, enviar, enviando] = useActionState(crearYAbrir, INICIAL);

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
  const [logo, setLogo] = useState<LogoListo | null>(null);
  const [leyendoLogo, setLeyendoLogo] = useState(false);
  const [avisoFoto, setAvisoFoto] = useState('');
  const [duenio, setDuenio] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);

  const opciones = giro.combinaciones
    .map((id) => COMBINACIONES.find((c) => c.id === id))
    .filter((c): c is CombinacionMarca => Boolean(c));
  const elegida =
    COMBINACIONES.find((c) => c.id === combinacionId) ?? opciones[0] ?? COMBINACIONES[0]!;
  // «Los de tu logo» manda sobre las combinaciones mientras esté elegido.
  const colores = combinacionId === 'logo' && logo?.colores ? logo.colores : elegida.colores;

  // Las vistas previas del logo se sueltan al cambiarlo o al salir.
  useEffect(
    () => () => {
      if (logo) {
        URL.revokeObjectURL(logo.vista);
        URL.revokeObjectURL(logo.vistaSello);
      }
    },
    [logo],
  );

  // Si el servidor rechaza un dato, se regresa al paso donde se escribe.
  // Tras «ya tienes club» se ofrece entrar; si corrige un dato, vuelve «Crear».
  const [corrigio, setCorrigio] = useState(false);
  useEffect(() => {
    if (estado.paso) setPaso(estado.paso);
    setCorrigio(false);
  }, [estado]);
  const ofrecerEntrar = Boolean(estado.yaTieneClub) && !corrigio;
  // Con el club creado, el botón sigue en «Creando…» mientras abre la página final.
  const creando = enviando || Boolean(estado.listo);

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
    if (combinacionId !== 'logo') setCombinacionId(nuevo.combinaciones[0]!);
  }

  async function leerLogo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setLeyendoLogo(true);
    setAvisoFoto('');
    try {
      const p = await prepararLogo(archivo);
      setLogo({
        ...p,
        vista: URL.createObjectURL(p.logo),
        vistaSello: URL.createObjectURL(p.sello),
      });
      if (p.colores) {
        setCombinacionId('logo');
        setAvisoFoto('Listo: tu tarjeta lleva los colores de tu logotipo. Puedes elegir otros.');
      } else {
        setAvisoFoto('Guardamos tu logotipo. Elige el color de tu tarjeta en la lista.');
      }
    } catch (err) {
      setAvisoFoto(
        err instanceof ImagenIlegible
          ? err.message
          : 'No pudimos leer esa imagen. Prueba con una captura de pantalla, un PNG o un JPG.',
      );
    } finally {
      setLeyendoLogo(false);
    }
  }

  function quitarLogo() {
    setLogo(null);
    setAvisoFoto('');
    if (combinacionId === 'logo') setCombinacionId(giro.combinaciones[0]!);
  }

  function revisar(n: 1 | 2 | 3): string {
    if (n === 1 && nombre.trim().length < 2) return 'Escribe el nombre de tu negocio.';
    if (n === 2 && premio.trim().length < 2) return 'Escribe el premio de tu tarjeta.';
    if (n === 3) {
      if (duenio.trim().length < 2) return 'Escribe tu nombre.';
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
      // Con logotipo, el envío lleva también la imagen ya preparada y su Sello.
      if (logo) {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        datos.set('logo', logo.logo, nombreDeLogo(logo.logo));
        datos.set('sello', logo.sello, 'sello.png');
        if (logo.colores) datos.set('colores', JSON.stringify(logo.colores));
        startTransition(() => enviar(datos));
      }
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
      onChange={() => {
        if (aviso) setAviso('');
        if (estado.yaTieneClub) setCorrigio(true);
      }}
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
        style={{ background: colores.fondo, color: colores.sobreFondo }}
        aria-hidden="true"
      >
        <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
          <span className="d h3" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {logo ? (
              <img
                src={logo.vistaSello}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 999, flex: 'none' }}
              />
            ) : null}
            {nombre.trim() || 'Tu negocio'}
          </span>
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
                      ? { background: colores.acento, borderColor: colores.acento }
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
        <div className="fs">
          <span className="fl" id="alta-logo" style={{ marginBottom: 8 }}>
            Tu logotipo <span style={{ fontWeight: 500 }}>(opcional)</span>
          </span>
          <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {logo ? (
              <img
                src={logo.vista}
                alt="Tu logotipo"
                style={{
                  height: 64,
                  maxWidth: 150,
                  objectFit: 'contain',
                  background: '#fff',
                  borderRadius: 12,
                  padding: 6,
                  border: '1.5px solid rgba(0,0,0,.12)',
                }}
              />
            ) : null}
            <label
              className="tab"
              htmlFor="alta-foto"
              aria-describedby="alta-logo-ayuda"
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              {leyendoLogo ? 'Preparando…' : logo ? 'Cambiar' : 'Subir mi logotipo'}
            </label>
            {logo ? (
              <button
                type="button"
                className="ul"
                onClick={quitarLogo}
                style={{
                  background: 'none',
                  border: 0,
                  padding: '0 4px',
                  minHeight: 44,
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Quitar
              </button>
            ) : null}
          </div>
          <input
            id="alta-foto"
            type="file"
            accept="image/*"
            className="oc"
            aria-labelledby="alta-logo"
            onChange={(e) => void leerLogo(e)}
          />
          <span id="alta-logo-ayuda" className="sm2" aria-live="polite">
            {avisoFoto ||
              'Una foto o captura sirve. Se queda en tu tarjeta, tu panel y tu cartel, y con sus colores armamos tu tarjeta.'}
          </span>
        </div>
        <fieldset className="fs">
          <legend className="fl" style={{ marginBottom: 8 }}>
            Color de tu tarjeta
          </legend>
          <div className="sws">
            {logo?.colores ? (
              <label className="sw" title="Los de tu logo">
                <input
                  type="radio"
                  name="combinacion"
                  value="logo"
                  checked={combinacionId === 'logo'}
                  onChange={() => setCombinacionId('logo')}
                />
                <span
                  style={{ background: logo.colores.fondo, borderColor: logo.colores.acento }}
                  aria-hidden="true"
                />
                <span className="oc">Los de tu logo</span>
              </label>
            ) : null}
            {opciones.map((c) => (
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
          <span className="sm2">
            {combinacionId === 'logo'
              ? 'Los de tu logo'
              : (opciones.find((c) => c.id === combinacionId)?.nombre ?? '')}
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
        <label className="fl" htmlFor="alta-duenio">
          Tu nombre
          <input
            id="alta-duenio"
            name="duenio"
            className="in"
            maxLength={80}
            autoComplete="name"
            value={duenio}
            onChange={(e) => setDuenio(e.target.value)}
          />
        </label>
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
      {ofrecerEntrar ? (
        <>
          <a href="/entrar" className="btn">
            Entrar a mi panel
          </a>
          <a
            href="/entrar/recuperar"
            className="tab"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            Olvidé mi contraseña
          </a>
          <span className="sm2">¿Es otro negocio? Cambia el correo y el WhatsApp.</span>
        </>
      ) : paso < 3 ? (
        <button type="submit" className="btn">
          Siguiente
        </button>
      ) : (
        <button type="submit" className="btn" disabled={creando}>
          {creando ? 'Creando tu club…' : 'Crear mi club gratis'}
        </button>
      )}
      {ofrecerEntrar ? null : <span className="sm2">7 días gratis. Sin tarjeta bancaria.</span>}
    </form>
  );
}
