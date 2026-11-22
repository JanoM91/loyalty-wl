import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wl/database', () => ({
  borrarClubesVencidos: vi.fn(async () => ({ borrados: [] })),
  conNegocio: vi.fn(),
  fotosEnUso: vi.fn(),
  fotosVencidas: vi.fn(),
  negociosActivos: vi.fn(async () => []),
  olvidarFotos: vi.fn(),
}));
vi.mock('@vercel/blob', () => ({ del: vi.fn(), list: vi.fn() }));

import { GET as borrarPausados } from '../src/app/api/cron/borrar-pausados/route';
import { GET as lealtadFotos } from '../src/app/api/cron/lealtad-fotos/route';
import { firmarEnlace, leerEnlace } from '../src/lib/enlaces-firmados';

const NEGOCIO = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const SECRETO = 'secreto-de-enlaces-0123456789';

const ENV_CLAVES = ['CRON_SECRET', 'WL_SECRETO_ENLACES', 'BLOB_READ_WRITE_TOKEN'] as const;
const respaldo: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_CLAVES) {
    respaldo[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_CLAVES) {
    if (respaldo[k] === undefined) delete process.env[k];
    else process.env[k] = respaldo[k];
  }
});

describe('enlaces firmados: el secreto no se comparte con CRON_SECRET', () => {
  it('con solo CRON_SECRET no firma ni valida', async () => {
    process.env.CRON_SECRET = 'cron-secreto-muy-largo-123456';
    expect(firmarEnlace('baja', NEGOCIO, ID)).toBeNull();
    expect(await leerEnlace('baja', NEGOCIO, `${ID}.${'a'.repeat(32)}`)).toBeNull();
  });

  it('un WL_SECRETO_ENLACES corto se rechaza', () => {
    process.env.WL_SECRETO_ENLACES = 'corto';
    expect(firmarEnlace('baja', NEGOCIO, ID)).toBeNull();
  });

  it('firma y verifica con WL_SECRETO_ENLACES válido', async () => {
    process.env.WL_SECRETO_ENLACES = SECRETO;
    process.env.CRON_SECRET = 'cron-secreto-muy-largo-123456';
    const token = firmarEnlace('correo', NEGOCIO, ID);
    expect(token).not.toBeNull();
    expect(await leerEnlace('correo', NEGOCIO, token ?? '')).toBe(ID);
  });

  it('rechaza firmas manipuladas y propósitos o negocios cruzados', async () => {
    process.env.WL_SECRETO_ENLACES = SECRETO;
    const token = firmarEnlace('baja', NEGOCIO, ID) ?? '';
    const alterado = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(await leerEnlace('baja', NEGOCIO, alterado)).toBeNull();
    expect(await leerEnlace('correo', NEGOCIO, token)).toBeNull();
    expect(await leerEnlace('baja', '33333333-3333-4333-8333-333333333333', token)).toBeNull();
  });

  it('rechaza si cambia el dato extra', async () => {
    process.env.WL_SECRETO_ENLACES = SECRETO;
    const token = firmarEnlace('baja', NEGOCIO, ID, 'x') ?? '';
    expect(await leerEnlace('baja', NEGOCIO, token, () => 'x')).toBe(ID);
    expect(await leerEnlace('baja', NEGOCIO, token, () => 'y')).toBeNull();
  });
});

describe.each([
  ['borrar-pausados', borrarPausados],
  ['lealtad-fotos', lealtadFotos],
])('cron %s: autorización', (_nombre, GET) => {
  const pedir = (auth?: string) =>
    GET(
      new Request('http://localhost/api/cron', {
        headers: auth === undefined ? {} : { authorization: auth },
      }),
    );

  it('401 sin header', async () => {
    process.env.CRON_SECRET = 'cron-secreto-muy-largo-123456';
    expect((await pedir()).status).toBe(401);
  });

  it('401 con CRON_SECRET vacío, incluso con Bearer vacío', async () => {
    process.env.CRON_SECRET = '';
    expect((await pedir('Bearer ')).status).toBe(401);
    expect((await pedir('Bearer undefined')).status).toBe(401);
  });

  it('401 con Bearer incorrecto', async () => {
    process.env.CRON_SECRET = 'cron-secreto-muy-largo-123456';
    expect((await pedir('Bearer otro')).status).toBe(401);
    expect((await pedir('cron-secreto-muy-largo-123456')).status).toBe(401);
  });

  it('200 con el Bearer correcto', async () => {
    process.env.CRON_SECRET = 'cron-secreto-muy-largo-123456';
    expect((await pedir('Bearer cron-secreto-muy-largo-123456')).status).toBe(200);
  });
});
