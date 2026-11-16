import { describe, expect, it } from 'vitest';
import { PROGRAMA_BASE } from '@wl/domain';
import type { VistaTarjeta } from '@wl/database';

import {
  avisoEstampas,
  construirPassJson,
  mensajeVacio,
  premiosListos,
  rgbDeHex,
  type NegocioPase,
} from '../src/lib/wallet/apple/modelo';
import {
  avisoPorCambio,
  construirClase,
  construirObjeto,
  idClase,
  idObjeto,
  mensajeGoogle,
  type NegocioGoogle,
} from '../src/lib/wallet/google/modelo';

const tarjeta = (extra: Partial<VistaTarjeta> = {}): VistaTarjeta => ({
  id: '0b6b3a1e-5b7e-4c2a-9c0d-0a1b2c3d4e5f',
  codigo: 'WL-AB12-CD34',
  nombre: 'Mariana',
  celular: null,
  correo: 'm@example.com',
  correoVerificado: true,
  celularVerificado: false,
  tieneContrasena: true,
  verificada: true,
  estampas: 7,
  ciclo: 2,
  posiciones: 10,
  promociones: false,
  cumpleDia: null,
  cumpleMes: null,
  alta: new Date('2026-10-01T00:00:00Z'),
  premios: [],
  visitas: [],
  ...extra,
});

const premio = (disponible: boolean) => ({
  id: 'p1',
  tipo: 'CORTESIA',
  nombre: 'Cortesía',
  incluye: '',
  posicion: 5,
  ciclo: 1,
  disponible,
  generado: new Date('2026-10-02T00:00:00Z'),
  entregado: disponible ? null : new Date('2026-10-03T00:00:00Z'),
  sucursalEntrega: null,
});

const cafe: NegocioPase = {
  nombre: 'Café El Buentueste',
  fondo: '#14100c',
  sobreFondo: '#fbf7f1',
  acento: '#d9a05b',
  ayuda: 'hola@cafe.example',
  sitioPrograma: 'sitio.mx/cafe-demo/lealtad',
  escribirNombre: true,
};

const identidad = {
  passTypeId: 'pass.mx.ejemplo.lealtad',
  teamId: 'ABCDE12345',
  webServiceUrl: 'https://sitio.mx/cafe-demo/api/wallet/apple',
  token: 'token-de-prueba-largo-123456',
  urlQr: 'https://sitio.mx/cafe-demo/lealtad/t/WL-AB12-CD34',
  urlTerminos: 'https://sitio.mx/cafe-demo/lealtad/terminos',
  urlTarjetaWeb: 'https://sitio.mx/cafe-demo/lealtad/tarjeta',
  sucursales: ['Centro'],
};

describe('Apple: pass.json por negocio', () => {
  it('identifica el pase con la tarjeta y lleva el mismo QR que la web', () => {
    const p = construirPassJson(tarjeta(), cafe, identidad, PROGRAMA_BASE);
    expect(p.serialNumber).toBe(tarjeta().id);
    expect(p.authenticationToken).toBe(identidad.token);
    expect(p.barcodes[0]!.message).toBe(identidad.urlQr);
    expect(p.barcodes[0]!.altText).toBe('WL-AB12-CD34');
    expect(p.sharingProhibited).toBe(true);
  });

  it('el servicio web del pase es el del negocio, con su tramo', () => {
    const p = construirPassJson(tarjeta(), cafe, identidad, PROGRAMA_BASE);
    expect(p.webServiceURL).toBe('https://sitio.mx/cafe-demo/api/wallet/apple');
  });

  it('lleva el nombre y los colores del negocio, no los de la plataforma', () => {
    const p = construirPassJson(tarjeta(), cafe, identidad, PROGRAMA_BASE);
    expect(p.organizationName).toBe('Café El Buentueste');
    expect(p.logoText).toBe('Café El Buentueste');
    expect(p.backgroundColor).toBe('rgb(20, 16, 12)');
    expect(p.foregroundColor).toBe('rgb(251, 247, 241)');
    expect(p.labelColor).toBe('rgb(217, 160, 91)');
    const texto = JSON.stringify(p).toLowerCase();
    expect(texto).not.toContain('lapana');
  });

  it('dos negocios con la misma tarjeta dan pases con marca distinta', () => {
    const barberia: NegocioPase = { ...cafe, nombre: 'Barbería Don Filo', fondo: '#101418' };
    const a = construirPassJson(tarjeta(), cafe, identidad, PROGRAMA_BASE);
    const b = construirPassJson(tarjeta(), barberia, identidad, PROGRAMA_BASE);
    expect(a.organizationName).not.toBe(b.organizationName);
    expect(a.backgroundColor).not.toBe(b.backgroundColor);
  });

  it('con logotipo propio, Wallet no escribe el nombre al lado', () => {
    const p = construirPassJson(
      tarjeta(),
      { ...cafe, escribirNombre: false },
      identidad,
      PROGRAMA_BASE,
    );
    expect(p.logoText).toBeUndefined();
  });

  it('muestra las estampas sobre las posiciones del programa del negocio', () => {
    const ocho = {
      ...PROGRAMA_BASE,
      posiciones: 8,
      hitos: [{ ...PROGRAMA_BASE.hitos[0]!, posicion: 8 }],
    };
    const p = construirPassJson(tarjeta({ estampas: 3 }), cafe, identidad, ocho);
    expect(p.storeCard.headerFields[0]!.value).toBe('3 de 8');
  });

  it('avisa de premios listos antes que del próximo premio', () => {
    const sin = construirPassJson(tarjeta(), cafe, identidad, PROGRAMA_BASE);
    expect(sin.storeCard.auxiliaryFields[0]!.label).toBe('PRÓXIMO PREMIO');
    const con = construirPassJson(
      tarjeta({ premios: [premio(true), premio(false)] }),
      cafe,
      identidad,
      PROGRAMA_BASE,
    );
    expect(premiosListos(tarjeta({ premios: [premio(true), premio(false)] }))).toBe(1);
    expect(con.storeCard.auxiliaryFields[0]!.label).toBe('PREMIOS LISTOS');
    expect(con.storeCard.auxiliaryFields[0]!.changeMessage).toBe('🎁 %@');
  });

  it('el campo de mensajes existe siempre, para que Apple pueda avisar', () => {
    const p = construirPassJson(tarjeta(), cafe, identidad, PROGRAMA_BASE);
    const m = p.storeCard.backFields[0]!;
    expect(m.key).toBe('mensaje');
    expect(m.value).toBe(mensajeVacio('Café El Buentueste'));
    const conMensaje = construirPassJson(
      tarjeta(),
      cafe,
      { ...identidad, mensaje: 'Mañana 2x1' },
      PROGRAMA_BASE,
    );
    expect(conMensaje.storeCard.backFields[0]!.value).toBe('Mañana 2x1');
  });

  it('con enlace personal, el reverso lo lleva y escapa la dirección', () => {
    const p = construirPassJson(
      tarjeta(),
      cafe,
      { ...identidad, urlPersonal: 'https://sitio.mx/cafe-demo/lealtad/mi/abc?a="x"' },
      PROGRAMA_BASE,
    );
    const campo = p.storeCard.backFields.find((c) => c.key === 'mi_tarjeta')!;
    expect(campo.attributedValue).toContain('&quot;x&quot;');
    expect(p.storeCard.backFields.some((c) => c.key === 'web')).toBe(false);
  });

  it('sin contacto de ayuda, no inventa uno', () => {
    const p = construirPassJson(tarjeta(), { ...cafe, ayuda: null }, identidad, PROGRAMA_BASE);
    expect(p.storeCard.backFields.some((c) => c.key === 'ayuda')).toBe(false);
  });

  it('el aviso de estampas celebra la tarjeta completa', () => {
    expect(avisoEstampas(0, 2)).toContain('Completaste');
    expect(avisoEstampas(0, 1)).toContain('Gracias');
    expect(avisoEstampas(4, 3)).toContain('Gracias');
  });

  it('convierte colores hexadecimales al formato de Apple', () => {
    expect(rgbDeHex('#ffffff')).toBe('rgb(255, 255, 255)');
    expect(rgbDeHex('ff8800')).toBe('rgb(255, 136, 0)');
    expect(rgbDeHex('no es color')).toBe('rgb(0, 0, 0)');
  });
});

const cafeGoogle: NegocioGoogle = {
  id: '11111111-2222-3333-4444-555555555555',
  nombre: 'Café El Buentueste',
  fondo: '#14100c',
  origen: 'https://sitio.mx/cafe-demo',
  huella: 'abc123def456',
};
const idGoogle = { issuerId: '3388000000012345678', urlQr: identidad.urlQr };

describe('Google: clase y objeto por negocio', () => {
  it('cada negocio tiene su clase, derivada de su id', () => {
    const otra = { ...cafeGoogle, id: '99999999-2222-3333-4444-555555555555' };
    expect(idClase(idGoogle.issuerId, cafeGoogle.id)).toBe(
      '3388000000012345678.wl_11111111222233334444555555555555',
    );
    expect(idClase(idGoogle.issuerId, otra.id)).not.toBe(idClase(idGoogle.issuerId, cafeGoogle.id));
  });

  it('la clase lleva la marca del negocio y sus imágenes', () => {
    const c = construirClase(idGoogle.issuerId, cafeGoogle);
    expect(c.issuerName).toBe('Café El Buentueste');
    expect(c.hexBackgroundColor).toBe('#14100c');
    expect(c.programLogo.sourceUri.uri).toBe(
      'https://sitio.mx/cafe-demo/api/wallet/imagen/logo.png?v=abc123def456',
    );
    expect(JSON.stringify(c).toLowerCase()).not.toContain('lapana');
  });

  it('el objeto pertenece a la clase del negocio y lleva el QR de la web', () => {
    const o = construirObjeto(tarjeta(), cafeGoogle, idGoogle, PROGRAMA_BASE);
    expect(o.id).toBe(idObjeto(idGoogle.issuerId, tarjeta().id));
    expect(o.classId).toBe(idClase(idGoogle.issuerId, cafeGoogle.id));
    expect(o.barcode.value).toBe(identidad.urlQr);
    expect(o.loyaltyPoints.balance.string).toBe('7 de 10');
  });

  it('la imagen cambia de dirección con las estampas y con el diseño', () => {
    const a = construirObjeto(tarjeta({ estampas: 3 }), cafeGoogle, idGoogle, PROGRAMA_BASE);
    const b = construirObjeto(tarjeta({ estampas: 4 }), cafeGoogle, idGoogle, PROGRAMA_BASE);
    const c = construirObjeto(
      tarjeta({ estampas: 3 }),
      { ...cafeGoogle, huella: 'otra' },
      idGoogle,
      PROGRAMA_BASE,
    );
    expect(a.heroImage.sourceUri.uri).toContain('/api/wallet/imagen/tira-3.png?v=abc123def456');
    expect(a.heroImage.sourceUri.uri).not.toBe(b.heroImage.sourceUri.uri);
    expect(a.heroImage.sourceUri.uri).not.toBe(c.heroImage.sourceUri.uri);
  });

  it('avisa una sola vez por cambio: el premio gana sobre la estampa', () => {
    const con = construirObjeto(
      tarjeta({ estampas: 5, premios: [premio(true)] }),
      cafeGoogle,
      idGoogle,
      PROGRAMA_BASE,
    );
    const sin = construirObjeto(tarjeta({ estampas: 4 }), cafeGoogle, idGoogle, PROGRAMA_BASE);
    expect(avisoPorCambio({ saldo: '4 de 10', premiosListos: false }, con)).toBe('PREMIO');
    expect(avisoPorCambio({ saldo: '3 de 10', premiosListos: false }, sin)).toBe('ESTAMPA');
    expect(avisoPorCambio({ saldo: '4 de 10', premiosListos: false }, sin)).toBeNull();
    expect(avisoPorCambio(null, sin)).toBeNull();
  });

  it('recorta y limpia los mensajes', () => {
    const m = mensajeGoogle('aviso 1/2', 'x'.repeat(100), 'y'.repeat(600), true);
    expect(m.id).toBe('aviso_1_2');
    expect(m.header).toHaveLength(80);
    expect(m.body).toHaveLength(500);
    expect(m.messageType).toBe('TEXT_AND_NOTIFY');
  });
});
