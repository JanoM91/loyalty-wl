import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as db from '../src/index';
import { CON_BD, en, negocioDePrueba } from './ayuda';

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

  it('«Tu marca» sin datos del negocio conserva el contacto; «Datos del negocio» solo cambia esos', async () => {
    const { nombre, plantilla, frase, colores } = cambios();
    const r = await en(a, () =>
      db.guardarMarca(
        { nombre, plantilla, frase, colores: { ...colores, fondo: '#123456' } },
        actor,
      ),
    );
    expect(r.ok).toBe(true);
    let leido = await db.negocioPorSlug('prueba-marca-a');
    expect(leido?.marca.colores.fondo).toBe('#123456');
    expect(leido?.marca.contacto.whatsapp).toBe('522281234567');

    const d = await en(a, () =>
      db.guardarDatosNegocio(
        {
          correo: 'nuevo@tacos.mx',
          whatsapp: '522289998877',
          sitio: '',
          instagram: '',
          razonSocial: 'Tacos SA',
          domicilio: 'Calle 1, Xalapa',
          correoPrivacidad: 'datos@tacos.mx',
        },
        actor,
      ),
    );
    expect(d.ok).toBe(true);
    leido = await db.negocioPorSlug('prueba-marca-a');
    expect(leido?.marca.colores.fondo).toBe('#123456');
    expect(leido?.marca.contacto).toMatchObject({
      correo: 'nuevo@tacos.mx',
      whatsapp: '522289998877',
    });
    expect(leido?.marca.legal.domicilio).toBe('Calle 1, Xalapa');
    const malo = await en(a, () =>
      db.guardarDatosNegocio(
        {
          correo: 'sin-arroba',
          whatsapp: '',
          sitio: '',
          instagram: '',
          razonSocial: '',
          domicilio: '',
          correoPrivacidad: '',
        },
        actor,
      ),
    );
    expect(malo.ok).toBe(false);
    // Se regresa el contacto para las pruebas que siguen.
    await en(a, () => db.guardarMarca(cambios(), actor));
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

  it('guarda un logotipo solo si el archivo es de este negocio', async () => {
    const buena = `https://x.public.blob.vercel-storage.com/negocios/${a.id}/marca/logoUrl-abc.png`;
    expect(await en(a, () => db.guardarLogo('logoUrl', buena, actor))).toEqual({ ok: true });
    expect((await db.negocioPorSlug('prueba-marca-a'))?.marca.logoUrl).toBe(buena);
    const ajena = buena.replace(a.id, b.id);
    expect((await en(a, () => db.guardarLogo('iconoUrl', ajena, actor))).ok).toBe(false);
    expect(
      (await en(a, () => db.guardarLogo('iconoUrl', 'https://atacante.com/x.png', actor))).ok,
    ).toBe(false);
    expect((await en(a, () => db.guardarLogo('iconoUrl', 'javascript:alert(1)', actor))).ok).toBe(
      false,
    );
    // Guardar la marca después no borra el logotipo.
    expect((await en(a, () => db.guardarMarca(cambios(), actor))).ok).toBe(true);
    expect((await db.negocioPorSlug('prueba-marca-a'))?.marca.logoUrl).toBe(buena);
    expect(await en(a, () => db.guardarLogo('logoUrl', null, actor))).toEqual({ ok: true });
    expect((await db.negocioPorSlug('prueba-marca-a'))?.marca.logoUrl).toBeNull();
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
