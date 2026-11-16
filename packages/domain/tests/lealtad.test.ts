import { describe, expect, it } from 'vitest';

import {
  PROGRAMA_BASE,
  clavePremioDesdeNombre,
  describirPremio,
  programaDesdeDatos,
  validarPrograma,
  type ProgramaLealtad,
} from '../src/loyalty/programa';
import {
  aplicarEstampas,
  claveTicket,
  decidirAcreditacion,
  diasEntre,
  esFechaValida,
  estampasAOtorgar,
  estampasPorImporte,
  formatoFechaCorta,
  importeElegible,
  inicioVentanaContingencia,
  normalizarCaja,
  normalizarFolio,
  proximoPremio,
  textoProximoPremio,
  textoRechazo,
  type MotivoRechazo,
  type SolicitudAcreditacion,
} from '../src/loyalty/motor';
import {
  ALFABETO_CODIGO,
  enmascararContacto,
  esCodigoVerificacion,
  esCumpleanosValido,
  extraerCodigoTarjeta,
  formarCodigoTarjeta,
  formatoCelular,
  interpretarContacto,
  normalizarCelular,
  normalizarCorreo,
} from '../src/loyalty/contacto';

const POR_IMPORTE: ProgramaLealtad = { ...PROGRAMA_BASE, modalidad: 'IMPORTE' };

/** El programa de un negocio cualquiera: cambia el premio de la décima estampa. */
const PROGRAMA_NEGOCIO: ProgramaLealtad = {
  ...PROGRAMA_BASE,
  version: 'v2',
  hitos: [
    PROGRAMA_BASE.hitos[0]!,
    {
      posicion: 10,
      premio: 'CAFE_GRANDE_POSTRE',
      nombre: 'Café grande + postre',
      incluye: 'Un café grande y un postre de la vitrina.',
    },
  ],
};

describe('programa base', () => {
  it('es neutro: 10 estampas, premios en la 5 y la 10', () => {
    expect(PROGRAMA_BASE.posiciones).toBe(10);
    expect(PROGRAMA_BASE.hitos.map((h) => [h.posicion, h.premio])).toEqual([
      [5, 'CORTESIA'],
      [10, 'PREMIO_MAYOR'],
    ]);
    expect(PROGRAMA_BASE.modalidad).toBe('VISITA');
    expect(PROGRAMA_BASE.ventanaContingenciaDias).toBe(2);
  });

  it('es coherente', () => {
    expect(validarPrograma(PROGRAMA_BASE)).toEqual([]);
  });

  it('describe cada premio para el mostrador', () => {
    expect(describirPremio(PROGRAMA_BASE, 'CORTESIA').nombre).toBe('Premio de cortesía');
    expect(describirPremio(PROGRAMA_BASE, 'PREMIO_MAYOR').nombre).toBe('Premio mayor');
    // Un premio ganado con una clave que ya no está en el programa se describe
    // con la clave misma.
    expect(describirPremio(PROGRAMA_BASE, 'OTRO_PREMIO').nombre).toBe('otro premio');
  });

  it('un negocio lo cambia sin perder coherencia', () => {
    expect(validarPrograma(PROGRAMA_NEGOCIO)).toEqual([]);
    expect(PROGRAMA_NEGOCIO.hitos.find((h) => h.posicion === 10)?.nombre).toBe(
      'Café grande + postre',
    );
    expect(PROGRAMA_NEGOCIO.hitos.find((h) => h.posicion === 5)?.premio).toBe('CORTESIA');
  });
});

describe('programaDesdeDatos', () => {
  it('reconstruye el programa guardado en la base', () => {
    const leido = programaDesdeDatos({
      version: 'v2',
      posiciones: 10,
      modalidad: 'VISITA',
      hitos: JSON.parse(JSON.stringify(PROGRAMA_NEGOCIO.hitos)),
      tramos: JSON.parse(JSON.stringify(PROGRAMA_NEGOCIO.tramos)),
      ventanaContingenciaDias: 2,
    });
    expect(leido).toEqual(PROGRAMA_NEGOCIO);
  });

  it('rechaza formas que no son un programa', () => {
    expect(
      programaDesdeDatos({
        version: 'v9',
        posiciones: 10,
        modalidad: 'VISITA',
        hitos: 'no',
        tramos: [],
        ventanaContingenciaDias: 2,
      }),
    ).toBeNull();
    expect(
      programaDesdeDatos({
        version: 'v9',
        posiciones: 10,
        modalidad: 'SEMANAL',
        hitos: [],
        tramos: [],
        ventanaContingenciaDias: 2,
      }),
    ).toBeNull();
  });

  it('si faltan nombre e incluye, usa la clave', () => {
    const leido = programaDesdeDatos({
      version: 'v1',
      posiciones: 10,
      modalidad: 'VISITA',
      hitos: [{ posicion: 5, premio: 'CORTESIA' }],
      tramos: [],
      ventanaContingenciaDias: 2,
    });
    expect(leido?.hitos[0]?.nombre).toBe('CORTESIA');
    expect(leido?.hitos[0]?.incluye).toBe('');
  });
});

describe('clavePremioDesdeNombre', () => {
  it('convierte el nombre en una clave estable', () => {
    expect(clavePremioDesdeNombre('Pan dulce grande + Pan dulce')).toBe(
      'PAN_DULCE_GRANDE_PAN_DULCE',
    );
    expect(clavePremioDesdeNombre('Café de especialidad')).toBe('CAFE_DE_ESPECIALIDAD');
  });
});

describe('validarPrograma', () => {
  it('detecta premios fuera de la tarjeta, repetidos o inválidos', () => {
    const malo: ProgramaLealtad = {
      ...PROGRAMA_BASE,
      hitos: [
        { posicion: 5, premio: 'CORTESIA', nombre: 'Pan dulce', incluye: '' },
        { posicion: 5, premio: 'PREMIO_MAYOR', nombre: 'Pan y café', incluye: '' },
        { posicion: 12, premio: 'PAN_Y_CAFE_2', nombre: 'Pan y café', incluye: '' },
        { posicion: 0, premio: 'PAN_DULCE_2', nombre: 'Pan dulce', incluye: '' },
      ],
    };
    const problemas = validarPrograma(malo);
    expect(problemas).toContain('Hay dos premios en la posición 5.');
    expect(problemas.some((p) => p.includes('queda fuera'))).toBe(true);
    expect(problemas.some((p) => p.includes('posición 0 no es válido'))).toBe(true);
  });

  it('detecta tarjetas sin posiciones y ventanas inválidas', () => {
    const problemas = validarPrograma({
      ...PROGRAMA_BASE,
      posiciones: 0,
      ventanaContingenciaDias: -1,
    });
    expect(problemas).toContain('La tarjeta necesita entre 1 y 30 posiciones.');
    expect(problemas).toContain('La ventana de contingencia debe ser un número de días (0 a 30).');
  });

  it('detecta tramos encimados, con huecos, sin tope antes de otro o al revés', () => {
    const problemas = validarPrograma({
      ...PROGRAMA_BASE,
      tramos: [
        { desdeCentavos: 0, hastaCentavos: 30_000, estampas: 1 },
        { desdeCentavos: 20_000, hastaCentavos: 40_000, estampas: 2 },
        { desdeCentavos: 50_000, hastaCentavos: null, estampas: 3 },
        { desdeCentavos: 90_000, hastaCentavos: 80_000, estampas: -1 },
      ],
    });
    expect(problemas).toContain('Los tramos 1 y 2 se enciman.');
    expect(problemas).toContain('Entre los tramos 2 y 3 hay importes sin estampas.');
    expect(problemas).toContain('El tramo 3 no tiene tope y no puede ir antes de otro.');
    expect(problemas).toContain('El tramo 4 termina antes de empezar.');
    expect(problemas).toContain('El tramo 4 otorga un número de estampas inválido.');
  });
});

describe('estampas', () => {
  it('descuenta la propina del importe y nunca queda negativo', () => {
    expect(importeElegible(18_500, 2_000)).toBe(16_500);
    expect(importeElegible(1_000, 5_000)).toBe(0);
    expect(importeElegible(10_000)).toBe(10_000);
  });

  it('en la modalidad por visita da una estampa sin importar el importe', () => {
    expect(estampasAOtorgar(PROGRAMA_BASE, 0)).toBe(1);
    expect(estampasAOtorgar(PROGRAMA_BASE, 250_000)).toBe(1);
  });

  it('en la modalidad por importe respeta los bordes de cada tramo', () => {
    expect(estampasAOtorgar(POR_IMPORTE, 29_999)).toBe(1);
    expect(estampasAOtorgar(POR_IMPORTE, 30_000)).toBe(2);
    expect(estampasAOtorgar(POR_IMPORTE, 99_999)).toBe(3);
    expect(estampasAOtorgar(POR_IMPORTE, 100_000)).toBe(4);
    expect(estampasAOtorgar(POR_IMPORTE, 5_000_000)).toBe(4);
  });

  it('un importe sin tramo no da estampas', () => {
    expect(
      estampasPorImporte(500, [{ desdeCentavos: 1_000, hastaCentavos: null, estampas: 1 }]),
    ).toBe(0);
  });
});

describe('aplicarEstampas', () => {
  it('suma una estampa sin premio', () => {
    const r = aplicarEstampas({ estampas: 2, ciclo: 1 }, 1, PROGRAMA_BASE);
    expect(r).toEqual({ saldo: { estampas: 3, ciclo: 1 }, premios: [], ciclosCompletados: 0 });
  });

  it('genera la cortesía al llegar a la quinta', () => {
    const r = aplicarEstampas({ estampas: 4, ciclo: 1 }, 1, PROGRAMA_BASE);
    expect(r.saldo).toEqual({ estampas: 5, ciclo: 1 });
    expect(r.premios).toEqual([{ premio: 'CORTESIA', posicion: 5, ciclo: 1 }]);
  });

  it('al llegar a la décima da el premio y empieza una tarjeta nueva', () => {
    const r = aplicarEstampas({ estampas: 9, ciclo: 1 }, 1, PROGRAMA_BASE);
    expect(r.saldo).toEqual({ estampas: 0, ciclo: 2 });
    expect(r.premios).toEqual([{ premio: 'PREMIO_MAYOR', posicion: 10, ciclo: 1 }]);
    expect(r.ciclosCompletados).toBe(1);
  });

  it('lo que sobra pasa a la tarjeta nueva (9 + 3 → premio de la 10 y 2 estampas)', () => {
    const r = aplicarEstampas({ estampas: 9, ciclo: 3 }, 3, PROGRAMA_BASE);
    expect(r.saldo).toEqual({ estampas: 2, ciclo: 4 });
    expect(r.premios).toEqual([{ premio: 'PREMIO_MAYOR', posicion: 10, ciclo: 3 }]);
  });

  it('una sola visita puede cruzar los dos premios', () => {
    const r = aplicarEstampas({ estampas: 4, ciclo: 1 }, 6, PROGRAMA_BASE);
    expect(r.premios.map((p) => p.posicion)).toEqual([5, 10]);
    expect(r.saldo).toEqual({ estampas: 0, ciclo: 2 });
  });

  it('cero o negativo no cambia nada', () => {
    expect(aplicarEstampas({ estampas: 3, ciclo: 1 }, 0, PROGRAMA_BASE).saldo).toEqual({
      estampas: 3,
      ciclo: 1,
    });
    expect(aplicarEstampas({ estampas: 3, ciclo: 1 }, -2, PROGRAMA_BASE).premios).toEqual([]);
  });
});

describe('próximo premio', () => {
  it('cuenta lo que falta para el siguiente premio de la tarjeta', () => {
    expect(proximoPremio(0, PROGRAMA_BASE)).toEqual({ faltan: 5, premio: 'CORTESIA', posicion: 5 });
    expect(proximoPremio(5, PROGRAMA_BASE)).toEqual({
      faltan: 5,
      premio: 'PREMIO_MAYOR',
      posicion: 10,
    });
    expect(proximoPremio(9, PROGRAMA_BASE)?.faltan).toBe(1);
    expect(proximoPremio(10, PROGRAMA_BASE)).toBeNull();
  });

  it('lo dice en español, en singular y en plural', () => {
    expect(textoProximoPremio(4, PROGRAMA_BASE)).toBe(
      'Te falta 1 estampa para tu premio de cortesía.',
    );
    expect(textoProximoPremio(1, PROGRAMA_BASE)).toBe(
      'Te faltan 4 estampas para tu premio de cortesía.',
    );
    expect(textoProximoPremio(7, PROGRAMA_BASE)).toBe('Te faltan 3 estampas para tu premio mayor.');
    expect(textoProximoPremio(10, PROGRAMA_BASE)).toBe('Tarjeta completa.');
  });
});

describe('tickets', () => {
  it('normaliza el folio para que el mismo ticket no entre dos veces', () => {
    expect(normalizarFolio('c2-12044')).toBe('C212044');
    expect(normalizarFolio(' C2 12044 ')).toBe('C212044');
    expect(normalizarFolio('Ñ-1')).toBe('N1');
  });

  it('una caja vacía es la caja 1', () => {
    expect(normalizarCaja('')).toBe('1');
    expect(normalizarCaja(' 2 ')).toBe('2');
  });

  it('la clave junta sucursal, caja, fecha y folio', () => {
    expect(claveTicket('suc-1', '2', '2026-09-17', 'c2-12044')).toBe('suc-1|2|2026-09-17|C212044');
    expect(claveTicket('suc-1', '', '2026-09-17', 'C2 12044')).toBe('suc-1|1|2026-09-17|C212044');
  });

  it('valida fechas de calendario reales', () => {
    expect(esFechaValida('2026-09-17')).toBe(true);
    expect(esFechaValida('2028-02-29')).toBe(true);
    expect(esFechaValida('2026-02-29')).toBe(false);
    expect(esFechaValida('17/09/2026')).toBe(false);
    expect(esFechaValida('')).toBe(false);
  });

  it('cuenta días entre fechas', () => {
    expect(diasEntre('2026-09-15', '2026-09-17')).toBe(2);
    expect(diasEntre('2026-09-17', '2026-09-17')).toBe(0);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(diasEntre('2026-09-18', '2026-09-17')).toBe(-1);
  });

  it('formatea fechas cortas en español', () => {
    expect(formatoFechaCorta('2026-09-17')).toBe('17 sep 2026');
    expect(formatoFechaCorta('no-es-fecha')).toBe('no-es-fecha');
  });

  it('calcula desde cuándo cabe una contingencia', () => {
    expect(inicioVentanaContingencia('2026-09-17', PROGRAMA_BASE)).toBe('2026-09-15');
  });
});

describe('decidirAcreditacion', () => {
  const base: SolicitudAcreditacion = {
    hoy: '2026-09-17',
    fechaCompra: '2026-09-17',
    folio: 'C2-12071',
    sucursalParticipa: true,
    yaAcumuloEnFecha: false,
    ticketDuplicado: false,
  };
  const decide = (cambios: Partial<SolicitudAcreditacion>) =>
    decidirAcreditacion({ ...base, ...cambios }, PROGRAMA_BASE);

  it('acredita el ticket de hoy', () => {
    expect(decide({})).toEqual({ tipo: 'ACREDITAR' });
  });

  it('rechaza si la sucursal no participa, antes que cualquier otra cosa', () => {
    expect(decide({ sucursalParticipa: false, folio: '' })).toEqual({
      tipo: 'RECHAZAR',
      motivo: 'SUCURSAL_NO_PARTICIPA',
    });
  });

  it('rechaza fechas faltantes o futuras', () => {
    expect(decide({ fechaCompra: '' })).toMatchObject({ motivo: 'FALTA_FECHA' });
    expect(decide({ fechaCompra: '2026-09-18' })).toMatchObject({ motivo: 'FECHA_FUTURA' });
  });

  it('una visita por sucursal y fecha de compra', () => {
    expect(decide({ yaAcumuloEnFecha: true })).toMatchObject({ motivo: 'YA_ACUMULO_EN_FECHA' });
  });

  it('pide folio y rechaza tickets ya usados', () => {
    expect(decide({ folio: ' - ' })).toMatchObject({ motivo: 'FALTA_FOLIO' });
    expect(decide({ ticketDuplicado: true })).toMatchObject({ motivo: 'TICKET_DUPLICADO' });
  });

  it('ayer y antier entran como contingencia; antes, a revisión', () => {
    expect(decide({ fechaCompra: '2026-09-16' })).toEqual({ tipo: 'CONTINGENCIA', diasAtras: 1 });
    expect(decide({ fechaCompra: '2026-09-15' })).toEqual({ tipo: 'CONTINGENCIA', diasAtras: 2 });
    expect(decide({ fechaCompra: '2026-09-12' })).toEqual({
      tipo: 'RECHAZAR',
      motivo: 'FUERA_DE_VENTANA',
    });
  });

  it('cada rechazo tiene un título y una indicación para la caja', () => {
    const motivos: MotivoRechazo[] = [
      'SUCURSAL_NO_PARTICIPA',
      'FALTA_FECHA',
      'FECHA_FUTURA',
      'YA_ACUMULO_EN_FECHA',
      'FALTA_FOLIO',
      'TICKET_DUPLICADO',
      'FUERA_DE_VENTANA',
    ];
    for (const m of motivos) {
      const t = textoRechazo(m, '2026-09-12');
      expect(t.titulo.length).toBeGreaterThan(5);
      expect(t.detalle.length).toBeGreaterThan(20);
    }
    expect(textoRechazo('FUERA_DE_VENTANA', '2026-09-12').detalle).toContain('12 sep 2026');
    expect(textoRechazo('YA_ACUMULO_EN_FECHA').detalle).not.toContain(' el ');
  });
});

describe('contacto', () => {
  it('normaliza celulares mexicanos como los escribe la gente', () => {
    expect(normalizarCelular('228 818 5964')).toBe('2288185964');
    expect(normalizarCelular('(228) 818-5964')).toBe('2288185964');
    expect(normalizarCelular('+52 228 818 5964')).toBe('2288185964');
    expect(normalizarCelular('+52 1 228 818 5964')).toBe('2288185964');
    expect(normalizarCelular('044 228 818 5964')).toBe('2288185964');
    expect(normalizarCelular('818 5964')).toBeNull();
    expect(normalizarCelular('0288185964')).toBeNull();
  });

  it('normaliza correos', () => {
    expect(normalizarCorreo('  Ana@Correo.MX ')).toBe('ana@correo.mx');
    expect(normalizarCorreo('ana@correo')).toBeNull();
    expect(normalizarCorreo('ana correo@x.mx')).toBeNull();
    expect(normalizarCorreo(`${'a'.repeat(250)}@x.mx`)).toBeNull();
  });

  it('distingue correo de celular', () => {
    expect(interpretarContacto('Ana@correo.mx')).toEqual({
      tipo: 'CORREO',
      valor: 'ana@correo.mx',
    });
    expect(interpretarContacto('228 555 0142')).toEqual({ tipo: 'CELULAR', valor: '2285550142' });
    expect(interpretarContacto('ana@')).toBeNull();
    expect(interpretarContacto('123')).toBeNull();
  });

  it('enmascara contactos para el personal', () => {
    expect(enmascararContacto('ana.demo@correo.mx')).toBe('an•••@correo.mx');
    expect(enmascararContacto('2285550142')).toBe('••••••0142');
    expect(enmascararContacto(null)).toBe('—');
  });

  it('da formato a un celular', () => {
    expect(formatoCelular('2285550142')).toBe('228 555 0142');
    expect(formatoCelular('123')).toBe('123');
  });
});

describe('código de tarjeta', () => {
  it('forma códigos WL-XXXX-XXXX con el alfabeto sin caracteres confusos', () => {
    const codigo = formarCodigoTarjeta([0, 1, 2, 3, 4, 5, 6, 255]);
    expect(codigo).toMatch(/^WL-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(codigo).toBe(`WL-ABCD-EFG${ALFABETO_CODIGO[255 % ALFABETO_CODIGO.length]}`);
    expect(ALFABETO_CODIGO).not.toMatch(/[01OIL]/);
  });

  it('exige bytes suficientes', () => {
    expect(() => formarCodigoTarjeta([1, 2, 3])).toThrow();
  });

  it('extrae el código del QR, del lector o de lo que se teclea', () => {
    expect(extraerCodigoTarjeta('https://cafe.ejemplo.mx/t/WL-ABCD-EFGH')).toBe('WL-ABCD-EFGH');
    expect(extraerCodigoTarjeta('wl-abcd-efgh')).toBe('WL-ABCD-EFGH');
    expect(extraerCodigoTarjeta('ABCDEFGH')).toBe('WL-ABCD-EFGH');
    expect(extraerCodigoTarjeta(' WL ABCD EFGH ')).toBe('WL-ABCD-EFGH');
    expect(extraerCodigoTarjeta('WL-ABCD-EFG0')).toBeNull();
    expect(extraerCodigoTarjeta('hola')).toBeNull();
    expect(extraerCodigoTarjeta('')).toBeNull();
  });

  it('reconoce códigos de verificación de seis dígitos', () => {
    expect(esCodigoVerificacion(' 482913 ')).toBe(true);
    expect(esCodigoVerificacion('48291')).toBe(false);
    expect(esCodigoVerificacion('48a913')).toBe(false);
  });

  it('acepta cumpleaños de calendario sin año', () => {
    expect(esCumpleanosValido(29, 2)).toBe(true);
    expect(esCumpleanosValido(31, 4)).toBe(false);
    expect(esCumpleanosValido(0, 1)).toBe(false);
    expect(esCumpleanosValido(10, 13)).toBe(false);
    expect(esCumpleanosValido(1.5, 1)).toBe(false);
  });
});
