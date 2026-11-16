/**
 * Alta de un negocio nuevo solo desde el panel de plataforma, sin tocar código:
 * Exkalibur entra → crea el negocio → copia el enlace del dueño → el dueño fija
 * su contraseña y entra a su panel → un cliente crea su tarjeta.
 *
 *   node tests/e2e/alta-negocio.mjs <carpeta-de-capturas>
 *
 * Necesita la aplicación corriendo en http://localhost:3200 (instalación
 * compartida) y las variables de la base. Crea y al final borra un negocio
 * «e2e-…» y una cuenta de plataforma «e2e-…».
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const carpeta = process.argv[2] ?? 'capturas';
mkdirSync(carpeta, { recursive: true });
const ORIGEN = 'http://localhost:3200';
const BD = path.resolve(import.meta.dirname, '../../packages/database');
const sufijo = randomBytes(3).toString('hex');
const slug = `e2e-tacos-${sufijo}`;
const correoPlataforma = `e2e-${sufijo}@ejemplo.mx`;
const clavePlataforma = `${randomBytes(9).toString('base64url')} frase larga`;
const claveDuenio = `${randomBytes(9).toString('base64url')} otra frase`;

let mal = 0;
const paso = (nombre, ok, detalle = '') => {
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) mal += 1;
};

// La cuenta de plataforma se crea como la crearía Jano: en la terminal.
execFileSync('npx', ['tsx', 'scripts/plataforma-usuario.ts', correoPlataforma, 'Prueba E2E'], {
  cwd: BD,
  input: `${clavePlataforma}\n`,
  stdio: ['pipe', 'ignore', 'ignore'],
});

const navegador = await chromium.launch({ channel: 'chrome' });
const foto = (p, n) => p.screenshot({ path: path.join(carpeta, `alta-${n}.png`), fullPage: true });
try {
  const equipo = await navegador.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await equipo.newPage();

  await p.goto(`${ORIGEN}/plataforma`);
  paso('Sin sesión, la plataforma manda a entrar', /\/plataforma\/entrar$/.test(p.url()));
  await p.locator('input[name=email]').fill(correoPlataforma);
  await p.locator('input[name=clave]').fill('contraseña equivocada');
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.getByText('Correo o contraseña incorrectos').waitFor();
  paso('Con contraseña equivocada no entra', /\/plataforma\/entrar$/.test(p.url()));
  await p.locator('input[name=clave]').fill(clavePlataforma);
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.waitForURL(/\/plataforma$/);
  paso('Exkalibur entra a la plataforma', true);

  const inicio = Date.now();
  await p.goto(`${ORIGEN}/plataforma/nuevo`);
  await p.locator('input[name=nombre]').fill('Tacos El Güero');
  await p.locator('input[name=slug]').fill(slug);
  await p.locator('input[name=frase]').fill('Al pastor desde 1987');
  await p.locator('input[name=prefijo]').fill('TG');
  await p.getByRole('button', { name: 'Mediterráneo' }).click();
  await p.locator('input[name=posiciones]').fill('6');
  await p.locator('input[name=premio]').fill('Orden de pastor gratis');
  await p.locator('input[name=premioIntermedio]').fill('Agua fresca');
  await p.locator('input[name=posicionIntermedio]').fill('3');
  await p.locator('textarea[name=sucursales]').fill('Centro\nAraucarias');
  await p.locator('input[name=duenioNombre]').fill('Don Güero');
  await p.locator('input[name=duenioEmail]').fill('guero@ejemplo.mx');
  await foto(p, '1-formulario');
  await p.getByRole('button', { name: 'Crear negocio' }).click();
  await p.waitForURL(new RegExp(`/plataforma/${slug}`), { timeout: 20000 });
  const enlace = (await p.locator('code').first().innerText()).trim();
  await foto(p, '2-ficha-con-enlace');
  paso(
    'El negocio se crea y muestra el enlace del dueño',
    enlace.includes(`/${slug}/admin/contrasena/`),
  );

  // El dueño, en otro navegador.
  const duenio = await (
    await navegador.newContext({ viewport: { width: 1200, height: 900 } })
  ).newPage();
  await duenio.goto(enlace);
  await duenio.locator('input[name=clave]').fill(claveDuenio);
  await duenio.locator('input[name=confirmacion]').fill(claveDuenio);
  await duenio.getByRole('button', { name: 'Guardar y entrar' }).click();
  await duenio.waitForURL(/\/admin(\/(?!contrasena)|$)/, { timeout: 15000 }).catch(() => {});
  await duenio.goto(`${ORIGEN}/${slug}/admin/lealtad/sucursales`);
  const sucursales = await duenio.locator('body').innerText();
  await foto(duenio, '3-panel-del-dueno');
  paso(
    'El dueño fija su contraseña y ve sus sucursales',
    sucursales.includes('Araucarias') && sucursales.includes('Centro'),
  );

  // Un cliente, en su celular.
  const cliente = await (
    await navegador.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await cliente.goto(`${ORIGEN}/${slug}`);
  const portada = await cliente.locator('body').innerText();
  paso(
    'La portada lleva su marca y su premio',
    portada.includes('Orden de pastor gratis') && /visita 6/.test(portada),
  );
  await cliente.getByRole('link', { name: 'Crear mi tarjeta' }).click();
  await cliente.getByRole('button', { name: 'Celular' }).click();
  await cliente
    .locator('input[name=contacto]')
    .fill(`228${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  await cliente.locator('input[name=terminos]').check();
  await cliente.getByRole('button', { name: 'Crear mi tarjeta' }).click();
  await cliente.waitForURL(/\/lealtad\/tarjeta/, { timeout: 15000 });
  const codigo = (await cliente.locator('body').innerText()).match(
    /TG-[A-Z0-9]{4}-[A-Z0-9]{4}/,
  )?.[0];
  await foto(cliente, '4-tarjeta-del-cliente');
  paso('Un cliente crea su tarjeta con el prefijo del negocio', Boolean(codigo), codigo ?? '');
  console.log(
    `  Tiempo del alta al primer cliente con tarjeta (automatizado): ${((Date.now() - inicio) / 1000).toFixed(0)} s`,
  );

  // Suspender cierra el programa; reactivar lo devuelve.
  await p.getByRole('button', { name: 'Suspender' }).click();
  await p.getByRole('button', { name: 'Reactivar' }).waitFor();
  const cerrado = await cliente.goto(`${ORIGEN}/${slug}/lealtad`);
  paso('Suspendido, el programa deja de abrir', cerrado.status() === 404);
  await p.getByRole('button', { name: 'Reactivar' }).click();
  await p.getByRole('button', { name: 'Suspender' }).waitFor();
  const abierto = await cliente.goto(`${ORIGEN}/${slug}/lealtad/tarjeta`);
  paso('Reactivado, vuelve a abrir', abierto.status() === 200);
} catch (e) {
  paso('El alta terminó sin errores', false, String(e).slice(0, 300));
} finally {
  await navegador.close();
  execFileSync('npx', ['tsx', 'scripts/e2e-borrar.ts', slug, correoPlataforma], {
    cwd: BD,
    stdio: 'ignore',
  });
  console.log(mal === 0 ? 'Alta de negocio: todo bien' : `Alta de negocio: ${mal} pasos mal`);
  if (mal) process.exitCode = 1;
}
