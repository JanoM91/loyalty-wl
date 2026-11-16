const { PrismaClient, Prisma } = require('./node_modules/.prisma/client/wasm.js');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002';
const cliente = (user, pass, max = 5) => new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: `postgresql://${user}:${pass}@localhost:5544/wlexp`, max })) });
const res = [];
const ok = (nombre, cond, detalle = '') => { res.push(cond); console.log(`${cond ? 'PASA ' : 'FALLA'} | ${nombre}${detalle ? ' → ' + detalle : ''}`); };
const falla = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

// Capa (b): helper que abre transacción y fija el tenant solo para esa transacción.
const conTenant = (prisma, tenantId, fn) => prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  return fn(tx);
});

// Capa (a): extensión que inyecta tenantId en cada operación del modelo.
const MODELOS_CON_TENANT = new Set(['Card']);
const porTenant = (prisma, tenantId) => prisma.$extends({
  query: { $allModels: { async $allOperations({ model, operation, args, query }) {
    if (!MODELOS_CON_TENANT.has(model)) return query(args);
    args = { ...args };
    if (['create'].includes(operation)) args.data = { ...args.data, tenantId };
    else if (operation === 'createMany') args.data = [].concat(args.data).map((d) => ({ ...d, tenantId }));
    else if (operation === 'upsert') { args.where = { ...args.where, tenantId }; args.create = { ...args.create, tenantId }; }
    else args.where = { ...(args.where ?? {}), tenantId };
    return query(args);
  } } },
});

(async () => {
  const app = cliente('wl_app', 'a'), owner = cliente('wl_owner', 'o');
  console.log('== RLS con rol de aplicación (no dueño) ==');
  ok('1 sin tenant fijado no se ve nada (falla cerrado)', (await app.card.count()) === 0);
  ok('2 con tenant A se ven solo las 2000 de A', (await conTenant(app, A, (tx) => tx.card.count())) === 2000);
  const deB = await owner.card.findFirst({ where: { tenantId: B } });
  ok('3 A no puede leer por id una tarjeta de B', (await conTenant(app, A, (tx) => tx.card.findUnique({ where: { id: deB.id } }))) === null);
  ok('4 A no puede actualizar una tarjeta de B (0 filas)', (await conTenant(app, A, (tx) => tx.card.updateMany({ where: { id: deB.id }, data: { stamps: 99 } }))).count === 0);
  ok('5 A no puede borrar tarjetas de B (0 filas)', (await conTenant(app, A, (tx) => tx.card.deleteMany({ where: { tenantId: B } }))).count === 0);
  const e6 = await falla(() => conTenant(app, A, (tx) => tx.card.create({ data: { tenantId: B, publicCode: 'X-1' } })));
  ok('6 A no puede insertar con tenant_id de B (WITH CHECK)', !!e6, e6 && String(e6.message).replace(/\s+/g, ' ').slice(-90));
  ok('7 $queryRaw dentro de la transacción también queda filtrado', Number((await conTenant(app, A, (tx) => tx.$queryRaw`SELECT count(*)::int AS n FROM card`))[0].n) === 2000);
  const fu = await conTenant(app, A, (tx) => tx.$queryRaw`SELECT id FROM card WHERE public_code = 'A-7' FOR UPDATE`);
  ok('8 SELECT … FOR UPDATE (como bloquearTarjeta) funciona bajo RLS', fu.length === 1);
  const e9 = await falla(() => app.card.create({ data: { tenantId: A, publicCode: 'X-2' } }));
  ok('9 insertar sin tenant fijado se rechaza', !!e9);

  console.log('== El ajuste no se filtra entre peticiones que comparten conexión ==');
  const app1 = cliente('wl_app', 'a', 1); // una sola conexión: fuerza la reutilización
  await conTenant(app1, A, (tx) => tx.card.count());
  ok('10 tras cerrar la transacción, la misma conexión ya no ve nada', (await app1.card.count()) === 0);
  const [nA, nB] = await Promise.all([conTenant(app1, A, (tx) => tx.card.count({ where: { publicCode: { startsWith: 'A-' } } })), conTenant(app1, B, (tx) => tx.card.count({ where: { publicCode: { startsWith: 'A-' } } }))]);
  ok('11 dos tenants alternando sobre 1 conexión no se cruzan', nA === 2000 && nB === 0, `A=${nA} B=${nB}`);
  const e12 = await falla(() => conTenant(app1, A, async (tx) => { await tx.card.count(); throw new Error('boom'); }));
  ok('12 tras un rollback tampoco queda fijado', !!e12 && (await app1.card.count()) === 0);

  console.log('== El dueño de las tablas se salta RLS ==');
  ok('13 el rol dueño ve todo sin fijar tenant (RLS no le aplica)', (await owner.card.count()) === 4000);
  await owner.$executeRawUnsafe('ALTER TABLE card FORCE ROW LEVEL SECURITY');
  ok('14 con FORCE ROW LEVEL SECURITY el dueño también queda filtrado', (await owner.card.count()) === 0);
  await owner.$executeRawUnsafe('ALTER TABLE card NO FORCE ROW LEVEL SECURITY');

  console.log('== Unicidad por negocio ==');
  const e15 = await falla(() => conTenant(app, A, (tx) => tx.card.create({ data: { tenantId: A, publicCode: 'A-NUEVA', phone: '2280000001' } })));
  ok('15 mismo celular dos veces en el mismo negocio se rechaza (P2002)', e15 && e15.code === 'P2002', e15 && e15.code);
  const c16 = await owner.card.count({ where: { phone: '2280000001' } });
  ok('16 el mismo celular existe en A y en B sin conflicto', c16 === 2);

  console.log('== Capa (a) sola: extensión de cliente, conectada como dueño (sin RLS) ==');
  const dbA = porTenant(owner, A);
  ok('17 count solo ve A', (await dbA.card.count()) === 2000);
  ok('18 findUnique por id de B devuelve null', (await dbA.card.findUnique({ where: { id: deB.id } })) === null);
  ok('19 findUnique por clave compuesta', (await dbA.card.findUnique({ where: { tenantId_publicCode: { tenantId: A, publicCode: 'A-7' } } }))?.publicCode === 'A-7');
  ok('20 updateMany sobre fila de B no cambia nada', (await dbA.card.updateMany({ where: { id: deB.id }, data: { stamps: 77 } })).count === 0);
  const e21 = await falla(() => dbA.card.update({ where: { id: deB.id }, data: { stamps: 77 } }));
  ok('21 update por id de B lanza «no encontrado»', e21 && e21.code === 'P2025', e21 && e21.code);
  const creada = await dbA.card.create({ data: { tenantId: B, publicCode: 'A-FORZADA' } });
  ok('22 create con tenantId de B termina guardado en A (la extensión pisa el valor)', creada.tenantId === A);
  const crudo = await dbA.$queryRaw`SELECT count(*)::int AS n FROM card`;
  ok('23 HUECO ESPERADO: $queryRaw NO pasa por la extensión (ve todo)', Number(crudo[0].n) > 4000, `n=${crudo[0].n}`);
  const fugaTx = await dbA.$transaction(async (tx) => tx.card.count());
  ok('24 dentro de $transaction interactiva la extensión sigue aplicando', fugaTx === 2001, `n=${fugaTx}`);

  console.log('== Latencia (local, sin red: mide el costo de los viajes extra, no Neon) ==');
  const N = 400; const med = async (fn) => { const t = []; for (let i = 0; i < N; i++) { const a = process.hrtime.bigint(); await fn(i); t.push(Number(process.hrtime.bigint() - a) / 1e6); } t.sort((x, y) => x - y); return { p50: t[N / 2].toFixed(2), p95: t[Math.floor(N * 0.95)].toFixed(2) }; };
  const q = (c, i) => c.card.findFirst({ where: { tenantId: A, publicCode: 'A-' + (1 + (i % 2000)) } });
  await med((i) => q(owner, i));
  const directo = await med((i) => q(owner, i));
  const conRls = await med((i) => conTenant(app, A, (tx) => q(tx, i)));
  const lote = await med((i) => app.$transaction([app.$executeRaw`SELECT set_config('app.tenant_id', ${A}, true)`, app.card.findFirst({ where: { publicCode: 'A-' + (1 + (i % 2000)) } })]));
  console.log(`   consulta directa (sin RLS):            p50 ${directo.p50} ms · p95 ${directo.p95} ms`);
  console.log(`   transacción interactiva + set_config:  p50 ${conRls.p50} ms · p95 ${conRls.p95} ms`);
  console.log(`   transacción por lote [set_config, q]:  p50 ${lote.p50} ms · p95 ${lote.p95} ms`);
  console.log(`\n${res.filter(Boolean).length}/${res.length} comprobaciones pasan`);
  await Promise.all([app.$disconnect(), owner.$disconnect(), app1.$disconnect()]);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
