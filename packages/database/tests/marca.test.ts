import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

describe('contraste de colores', () => {
  it('mide como WCAG', () => {
    expect(db.contraste('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(db.contraste('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(db.contraste('#ffffff', '#ffffff')).toBe(1);
  });

  it('rechaza una tarjeta ilegible y solo avisa de un acento tenue', () => {
    const base = db.MARCA_POR_OMISION.colores;
    expect(db.revisarColores(base).errores).toEqual([]);
    expect(db.revisarColores({ ...base, sobreFondo: '#333333' }).errores).toHaveLength(1);
    const tenue = db.revisarColores({ ...base, acento: '#2a2a2c' });
    expect(tenue.errores).toEqual([]);
    expect(tenue.avisos).toHaveLength(1);
  });
});

describe.skipIf(!CON_BD)('el negocio edita su marca', () => {
  let a: db.Negocio;
  let b: db.Negocio;
  const cambios = (extra: Partial<db.CambiosMarca> = {}): db.CambiosMarca => ({
    nombre: 'Tacos El Güero',
    plantilla: 'noche',
    frase: 'Al pastor desde 1987',
    colores: {
      fondo: '#b3261e',
      sobreFondo: '#ffffff',
      acento: '#ffd60a',
      papel: '#101010',
      tinta: '#f5f5f5',
    },
    correo: 'Hola@Tacos.mx',
    whatsapp: '228 123 4567',
    sitio: '',
    instagram: '@tacoselguero',
    razonSocial: '',
    domicilio: '',
    correoPrivacidad: '',
    ...extra,
  });
  let actor: { userId: string };

  beforeAll(async () => {
    a = await negocioDePrueba({ slug: 'prueba-marca-a', nombre: 'Negocio A', prefijoCodigo: 'MA' });
    b = await negocioDePrueba({ slug: 'prueba-marca-b', nombre: 'Negocio B', prefijoCodigo: 'MB' });
    actor = await en(a, async () => {
      const u = await db.prisma.userAccount.create({
        data: { email: 'duenio@ejemplo.mx', name: 'Dueño', role: 'DUENO' },
      });
      return { userId: u.id };
    });
  });

  afterAll(async () => {
    if (a) await db.borrarNegocio(a.id);
    if (b) await db.borrarNegocio(b.id);
    await db.desconectar();
    await db.desconectarPlataforma();
  });

  it('guarda nombre, diseño, colores y contacto, y deja bitácora', async () => {
    const r = await en(a, () => db.guardarMarca(cambios(), actor));
    expect(r.ok).toBe(true);
    const leido = await db.negocioPorSlug('prueba-marca-a');
    expect(leido?.nombre).toBe('Tacos El Güero');
    expect(leido?.marca.plantilla).toBe('noche');
    expect(leido?.marca.colores.fondo).toBe('#b3261e');
    expect(leido?.marca.contacto).toMatchObject({
      correo: 'hola@tacos.mx',
      whatsapp: '522281234567',
    });
    expect(leido?.marca.redes.instagram).toBe('tacoselguero');
    const bitacora = await en(a, () =>
      db.prisma.auditLog.count({ where: { action: 'marca.guardar' } }),
    );
    expect(bitacora).toBe(1);
  });

  it('no toca al otro negocio', async () => {
    const otro = await db.negocioPorSlug('prueba-marca-b');
    expect(otro?.nombre).toBe('Negocio B');
    expect(otro?.marca.plantilla).toBe('aire');
  });

  it('rechaza colores ilegibles y datos mal escritos sin guardar nada', async () => {
    const ilegible = await en(a, () =>
      db.guardarMarca(cambios({ colores: { ...cambios().colores, sobreFondo: '#b3261e' } }), actor),
    );
    expect(ilegible.ok).toBe(false);
    expect((await en(a, () => db.guardarMarca(cambios({ plantilla: 'otra' }), actor))).ok).toBe(
      false,
    );
    expect((await en(a, () => db.guardarMarca(cambios({ whatsapp: '123' }), actor))).ok).toBe(
      false,
    );
    expect((await en(a, () => db.guardarMarca(cambios({ sitio: 'http://x.mx' }), actor))).ok).toBe(
      false,
    );
    expect((await db.negocioPorSlug('prueba-marca-a'))?.marca.colores.sobreFondo).toBe('#ffffff');
  });

  it('la base impide editar otro negocio, cambiar su estado o sus ajustes', async () => {
    // Fila ajena: la política la deja fuera, no se actualiza nada.
    const ajena = await en(a, () =>
      db.transaccion(
        (tx) => tx.$executeRaw`UPDATE tenant SET name = 'Robado' WHERE id = ${b.id}::uuid`,
      ),
    );
    expect(ajena).toBe(0);
    expect((await db.negocioPorSlug('prueba-marca-b'))?.nombre).toBe('Negocio B');
    // Columnas de plataforma: sin permiso ni en la fila propia.
    await expect(
      en(a, () =>
        db.transaccion(
          (tx) =>
            tx.$executeRaw`UPDATE tenant SET settings = '{"plan":"PRIVADA"}' WHERE id = ${a.id}::uuid`,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      en(a, () =>
        db.transaccion(
          (tx) => tx.$executeRaw`UPDATE tenant SET status = 'SUSPENDIDO' WHERE id = ${a.id}::uuid`,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      en(a, () =>
        db.transaccion((tx) => tx.$executeRaw`DELETE FROM tenant WHERE id = ${a.id}::uuid`),
      ),
    ).rejects.toThrow();
  });
});
