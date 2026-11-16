import { describe, expect, it } from 'vitest';

import { fotoDelNegocio } from '../src/lib/lealtad/fotos';
import { negocioDeLaRuta, slugDelHost } from '../src/middleware';

describe('slugDelHost: de qué negocio es una dirección', () => {
  const raiz = 'ejemplo.mx';

  it('toma el subdominio del dominio de plataforma', () => {
    expect(slugDelHost('cafe.ejemplo.mx', raiz)).toBe('cafe');
    expect(slugDelHost('Cafe-Centro.Ejemplo.MX:443', raiz)).toBe('cafe-centro');
  });

  it('en desarrollo acepta <negocio>.localhost', () => {
    expect(slugDelHost('barberia.localhost:3200', raiz)).toBe('barberia');
    expect(slugDelHost('barberia.localhost', undefined)).toBe('barberia');
  });

  it('el dominio de plataforma y los reservados no son negocios', () => {
    expect(slugDelHost('ejemplo.mx', raiz)).toBeNull();
    expect(slugDelHost('localhost:3200', raiz)).toBeNull();
    expect(slugDelHost('www.ejemplo.mx', raiz)).toBeNull();
    expect(slugDelHost('admin.ejemplo.mx', raiz)).toBeNull();
  });

  it('no acepta otros dominios ni subdominios anidados o raros', () => {
    expect(slugDelHost('cafe.otro.mx', raiz)).toBeNull();
    expect(slugDelHost('cafe.ejemplo.mx.atacante.com', raiz)).toBeNull();
    expect(slugDelHost('a.b.ejemplo.mx', raiz)).toBeNull();
    expect(slugDelHost('-cafe.ejemplo.mx', raiz)).toBeNull();
    expect(slugDelHost('cafe_1.ejemplo.mx', raiz)).toBeNull();
    expect(slugDelHost('', raiz)).toBeNull();
    // Sin dominio raíz configurado, solo vale .localhost.
    expect(slugDelHost('cafe.ejemplo.mx', undefined)).toBeNull();
  });
});

describe('fotoDelNegocio: solo fotos del almacén y de este negocio', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const buena = `https://abc.public.blob.vercel-storage.com/negocios/${id}/lealtad/tickets/centro/2026-11-15-x.jpg`;

  it('acepta la foto del propio negocio', () => {
    expect(fotoDelNegocio(buena, id)).toBe(buena);
  });

  it('descarta la de otro negocio, otros sitios y cosas que no son direcciones', () => {
    expect(fotoDelNegocio(buena, '22222222-2222-4222-8222-222222222222')).toBeNull();
    expect(fotoDelNegocio(`https://atacante.com/negocios/${id}/lealtad/x.jpg`, id)).toBeNull();
    expect(fotoDelNegocio(buena.replace('https:', 'http:'), id)).toBeNull();
    expect(
      fotoDelNegocio(`https://abc.public.blob.vercel-storage.com/otros/../negocios/${id}/x`, id),
    ).toBeNull();
    expect(fotoDelNegocio('javascript:alert(1)', id)).toBeNull();
    expect(fotoDelNegocio('', id)).toBeNull();
    expect(fotoDelNegocio(null, id)).toBeNull();
  });
});

describe('negocioDeLaRuta: el negocio va en el primer tramo de la dirección', () => {
  it('separa el negocio del resto', () => {
    expect(negocioDeLaRuta('/cafe/lealtad/tarjeta')).toEqual({
      slug: 'cafe',
      resto: '/lealtad/tarjeta',
    });
    expect(negocioDeLaRuta('/tacos-el-guero')).toEqual({ slug: 'tacos-el-guero', resto: '/' });
    expect(negocioDeLaRuta('/cafe/')).toEqual({ slug: 'cafe', resto: '/' });
  });

  it('las rutas del sitio no son negocios', () => {
    expect(negocioDeLaRuta('/')).toBeNull();
    expect(negocioDeLaRuta('/lealtad/tarjeta')).toBeNull();
    expect(negocioDeLaRuta('/admin')).toBeNull();
    expect(negocioDeLaRuta('/api/cron/lealtad-fotos')).toBeNull();
    expect(negocioDeLaRuta('/Cafe/lealtad')).toBeNull();
    expect(negocioDeLaRuta('/favicon.ico')).toBeNull();
  });
});
