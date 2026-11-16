/**
 * Siembra dos negocios de demostración con marca, programa y reglas distintos:
 * una cadena de cafeterías y una barbería. Sirve para ver la plataforma con
 * más de un negocio y para las demos comerciales.
 *
 *     pnpm db:seed
 *
 * Necesita DIRECT_URL (rol dueño) y DATABASE_URL (rol de la aplicación). Se
 * puede correr varias veces: un negocio que ya existe se deja como está.
 * No crea contraseñas: imprime el enlace de un solo uso con el que el dueño de
 * cada negocio fija la suya.
 */
import {
  crearNegocio,
  desconectar,
  desconectarPlataforma,
  invitarDuenio,
  negocioPorSlug,
  type NegocioNuevo,
} from '../src/index';

const DEMOS: readonly (NegocioNuevo & { duenio: { email: string; nombre: string } })[] = [
  {
    slug: 'cafe-demo',
    nombre: 'Café El Buentueste',
    prefijoCodigo: 'CB',
    marca: {
      frase: 'Café de altura, tostado en casa',
      colores: {
        fondo: '#1f2a24',
        sobreFondo: '#f6f1e7',
        acento: '#d9a441',
        papel: '#f4efe6',
        tinta: '#1b1f1c',
      },
      contacto: { correo: 'hola@cafe-demo.ejemplo.mx', whatsapp: null, sitio: null },
    },
    programa: {
      posiciones: 8,
      modalidad: 'VISITA',
      hitos: [
        {
          posicion: 4,
          premio: 'CAFE_DEL_DIA',
          nombre: 'Café del día',
          incluye: 'Un café del día, chico.',
        },
        {
          posicion: 8,
          premio: 'BEBIDA_Y_POSTRE',
          nombre: 'Bebida + postre',
          incluye: 'Una bebida de la barra y un postre de la vitrina.',
        },
      ],
      tramos: [],
      ventanaContingenciaDias: 2,
    },
    sucursales: [
      { slug: 'centro', nombre: 'Centro', ciudad: 'Xalapa', estado: 'Veracruz', participa: true },
      {
        slug: 'animas',
        nombre: 'Las Ánimas',
        ciudad: 'Xalapa',
        estado: 'Veracruz',
        participa: true,
      },
      {
        slug: 'boca',
        nombre: 'Boca del Río',
        ciudad: 'Boca del Río',
        estado: 'Veracruz',
        participa: true,
      },
      {
        slug: 'coatepec',
        nombre: 'Coatepec',
        ciudad: 'Coatepec',
        estado: 'Veracruz',
        participa: false,
      },
    ],
    duenio: { email: 'duenio@cafe-demo.ejemplo.mx', nombre: 'Dueña del café' },
  },
  {
    slug: 'barberia-demo',
    nombre: 'Barbería Don Filo',
    prefijoCodigo: 'DF',
    ajustes: { comprobanteConQr: 'OBLIGATORIO' },
    marca: {
      frase: 'Cortes clásicos desde 1998',
      colores: {
        fondo: '#12233d',
        sobreFondo: '#f4f6fa',
        acento: '#e2574c',
        papel: '#eef1f6',
        tinta: '#10192b',
      },
      contacto: { correo: 'hola@barberia-demo.ejemplo.mx', whatsapp: null, sitio: null },
    },
    programa: {
      posiciones: 5,
      modalidad: 'VISITA',
      hitos: [
        {
          posicion: 5,
          premio: 'CORTE_GRATIS',
          nombre: 'Corte gratis',
          incluye: 'Un corte clásico.',
        },
      ],
      tramos: [],
      ventanaContingenciaDias: 1,
    },
    sucursales: [
      { slug: 'centro', nombre: 'Centro', ciudad: 'Xalapa', estado: 'Veracruz', participa: true },
    ],
    duenio: { email: 'duenio@barberia-demo.ejemplo.mx', nombre: 'Dueño de la barbería' },
  },
];

async function main(): Promise<void> {
  for (const demo of DEMOS) {
    const { duenio, ...datos } = demo;
    let negocio = await negocioPorSlug(demo.slug);
    if (negocio) {
      console.warn(`· ${demo.slug}: ya existe, no se toca.`);
      continue;
    }
    const r = await crearNegocio(datos);
    if (!r.ok) throw new Error(`${demo.slug}: ${r.error}`);
    negocio = r.negocio;
    const invitacion = await invitarDuenio(negocio, duenio);
    if (!invitacion.ok) throw new Error(`${demo.slug}: ${invitacion.error}`);
    console.warn(
      `✓ ${demo.slug}: ${negocio.nombre}\n` +
        `  Dueño: ${duenio.email}\n` +
        `  Para fijar su contraseña (un solo uso, vence ${invitacion.expira.toISOString()}):\n` +
        `  /admin/contrasena/${invitacion.token}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await desconectar();
    await desconectarPlataforma();
  });
