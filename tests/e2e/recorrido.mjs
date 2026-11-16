/**
 * Recorrido completo en el navegador, para un negocio:
 * alta del cliente → el dueño fija su contraseña y entra → visita en caja →
 * (se completan las estampas que faltan directo en la base) → premio en caja →
 * el cliente ve su premio canjeado.
 *
 *   node tests/e2e/recorrido.mjs <slug> <correo-del-dueño> <carpeta-de-capturas>
 *
 * Necesita la aplicación corriendo en http://localhost:3200, las
 * variables de la base (DATABASE_URL, DIRECT_URL) y Chrome con Playwright.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const PW = process.env.PLAYWRIGHT_PATH ?? 'playwright';
const { chromium } = await import(PW);

const [slug, correoDuenio, carpeta = 'capturas'] = process.argv.slice(2);
// Instalación compartida: el negocio va en la ruta. Para probar otra forma,
// pasa BASE (por ejemplo http://cafe-demo.localhost:3200).
const BASE = process.env.BASE ?? `http://localhost:3200/${slug}`;
const BD = path.resolve(import.meta.dirname, '../../packages/database');
mkdirSync(carpeta, { recursive: true });

const pasos = [];
function paso(nombre, ok, detalle = '') {
  pasos.push({ nombre, ok });
  console.log(`${ok ? '✓' : '✗'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) process.exitCode = 1;
}
const tsx = (archivo, ...args) =>
  execFileSync('npx', ['tsx', archivo, ...args], {
    cwd: BD,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const navegador = await chromium.launch({
  channel: 'chrome',
  args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1'],
});
const foto = (pagina, nombre) =>
  pagina.screenshot({ path: path.join(carpeta, `${slug}-${nombre}.png`), fullPage: true });

try {
  // --- 1. Alta del cliente en su celular ---
  const celular = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const cliente = await celular.newPage();
  await cliente.goto(`${BASE}/lealtad`);
  await foto(cliente, '1-portada');
  await cliente.getByRole('link', { name: 'Crear mi tarjeta' }).click();
  const numero = `228${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  await cliente.getByRole('button', { name: 'Celular' }).click();
  await cliente.locator('input[name=contacto]').fill(numero);
  await cliente.locator('input[name=terminos]').check();
  await cliente.getByRole('button', { name: 'Crear mi tarjeta' }).click();
  await cliente
    .waitForURL(/\/lealtad\/(tarjeta|verificar|perfil|acceso|contrasena)/, { timeout: 15000 })
    .catch(() => {});
  if (!/\/lealtad\/tarjeta/.test(cliente.url())) await cliente.goto(`${BASE}/lealtad/tarjeta`);
  const texto1 = await cliente.locator('body').innerText();
  const codigo = texto1.match(/[A-Z]{2,4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0];
  paso('Alta web: la tarjeta existe y muestra su código', Boolean(codigo), codigo ?? cliente.url());
  await foto(cliente, '2-tarjeta-nueva');
  if (!codigo) throw new Error('sin código');

  // --- 2. El dueño fija su contraseña con el enlace de un solo uso y entra ---
  const enlace = tsx('scripts/invitar.ts', slug, correoDuenio).match(
    /\/admin\/contrasena\/\S+/,
  )?.[0];
  const clave = `${randomBytes(9).toString('base64url')} frase larga`;
  const escritorio = await navegador.newContext({ viewport: { width: 1200, height: 900 } });
  const panel = await escritorio.newPage();
  await panel.goto(`${BASE}${enlace}`);
  await panel.locator('input[name=clave]').fill(clave);
  await panel.locator('input[name=confirmacion]').fill(clave);
  await panel.getByRole('button', { name: 'Guardar y entrar' }).click();
  await panel.waitForURL(/\/admin(\/(?!contrasena)|$)/, { timeout: 15000 }).catch(() => {});
  if (/\/admin\/entrar/.test(panel.url())) {
    await panel.locator('input[name=email]').fill(correoDuenio);
    await panel.locator('input[name=clave]').fill(clave);
    await panel.getByRole('button', { name: 'Entrar' }).click();
    await panel.waitForURL(/\/admin\/lealtad/, { timeout: 15000 }).catch(() => {});
  }
  await panel.goto(`${BASE}/admin/lealtad`);
  paso(
    'Panel: el dueño fija contraseña y entra',
    /\/admin\/lealtad$/.test(panel.url()),
    panel.url(),
  );
  await foto(panel, '3-panel-resumen');

  // --- 3. Visita en caja, sin folio: se acredita igual y queda anotada ---
  await panel.goto(`${BASE}/admin/lealtad/caja?sucursal=centro`);
  await panel
    .getByRole('button', { name: /^Registrar visita\b(?! sin)/ })
    .first()
    .click();
  await panel.locator('input[name=codigo]').fill(codigo);
  await panel.getByRole('button', { name: 'Buscar' }).click();
  await panel.getByRole('button', { name: /Registrar el ticket/ }).click();
  const obligatorio = process.env.FOLIO_OBLIGATORIO === '1';
  if (obligatorio) {
    // Este negocio exige comprobante: primero se intenta sin folio.
    await panel.getByLabel(/Confirmo que el cliente compró hoy/).check();
    await panel.getByRole('button', { name: /Confirmar y acreditar/ }).click();
    await panel.waitForTimeout(1500);
    const rechazo = await panel.locator('body').innerText();
    paso(
      'Caja: sin folio NO acredita (regla de este negocio)',
      /folio|ticket|comprobante/i.test(rechazo) &&
        !/Visita acreditada|acreditada/i.test(rechazo.split('Hoy en esta caja')[0] ?? ''),
    );
    await foto(panel, '5a-caja-sin-folio-rechazada');
    await panel.getByRole('button', { name: 'Corregir los datos' }).click();
    await panel.locator('#folio').fill(`E2E-${Date.now()}`);
    if (!(await panel.getByLabel(/Confirmo que el cliente compró hoy/).isChecked()))
      await panel.getByLabel(/Confirmo que el cliente compró hoy/).check();
  } else {
    await panel.getByLabel(/Confirmo que el cliente compró hoy/).check();
  }
  await panel.getByRole('button', { name: /Confirmar y acreditar/ }).click();
  await panel.waitForTimeout(2000);
  await foto(panel, '5-caja-visita');
  const trasVisita = await panel.locator('body').innerText();
  paso(
    obligatorio
      ? 'Caja: con folio, la visita se acredita'
      : 'Caja: la visita se acredita sin folio',
    /\+1\s+estampa/.test(trasVisita.replace(/\s+/g, ' ')),
  );

  await cliente.goto(`${BASE}/lealtad/tarjeta`);
  const conUna = await cliente.locator('body').innerText();
  paso(
    'Cliente: su tarjeta muestra 1 estampa',
    /\b1\s*de \d+ estampas/.test(conUna.replace(/\n/g, ' ')),
  );

  // --- 3b. Apple Wallet (solo si el servidor tiene certificado: WALLET_PRUEBA=1) ---
  if (process.env.WALLET_PRUEBA === '1') await probarAppleWallet(cliente);
  await foto(cliente, '6-tarjeta-una-estampa');

  // --- 4. Atajo declarado: estampas que faltan y contacto verificado, en la base ---
  console.log(
    `  (atajo en la base: ${tsx('scripts/e2e-completar.ts', slug, codigo).trim()}; contacto verificado)`,
  );

  // --- 5. Premio: el cliente lo ve y la caja lo entrega ---
  await cliente.goto(`${BASE}/lealtad/premios`);
  await foto(cliente, '7-premio-disponible');
  const premios = await cliente.locator('body').innerText();
  paso('Cliente: ve su premio disponible', /disponible|canj/i.test(premios));

  await panel.goto(`${BASE}/admin/lealtad/caja?sucursal=centro`);
  await panel
    .getByRole('button', { name: /^Entregar premio/ })
    .first()
    .click();
  await panel.locator('input[name=codigo]').fill(codigo);
  await panel.getByRole('button', { name: 'Buscar' }).click();
  await panel
    .getByRole('button', { name: /Entregar premio/ })
    .last()
    .click();
  await panel.getByLabel(/Confirmo que entregué el producto/).check();
  await panel.getByRole('button', { name: /Confirmar entrega/ }).click();
  await panel.waitForTimeout(2000);
  await foto(panel, '8-caja-premio-entregado');
  const trasEntrega = await panel.locator('body').innerText();
  paso('Caja: el premio se entrega', /entregad/i.test(trasEntrega));

  await cliente.goto(`${BASE}/lealtad/premios`);
  await foto(cliente, '9-premio-canjeado');
  const canjeado = await cliente.locator('body').innerText();
  paso('Cliente: su premio aparece canjeado', /canjead|entregad/i.test(canjeado));

  // --- 6. El panel lo refleja ---
  await panel.goto(`${BASE}/admin/lealtad/tarjetas/${codigo}`);
  await foto(panel, '10-panel-tarjeta');
  paso(
    'Panel: el detalle de la tarjeta abre',
    (await panel.locator('body').innerText()).includes(codigo),
  );
  // --- 7. El dueño abre su marca y la guarda (sin cambiarla) ---
  await panel.goto(`${BASE}/admin/marca`);
  await foto(panel, '12-panel-marca');
  await panel.getByRole('button', { name: 'Guardar marca' }).click();
  await panel
    .getByText('Marca guardada')
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  paso('Panel: la marca se guarda', /Marca guardada/.test(await panel.locator('body').innerText()));

  // --- 8. Ayuda con los datos del negocio y alta de una sucursal ---
  await panel.goto(`${BASE}/admin/ayuda`);
  await foto(panel, '13-panel-ayuda');
  const ayuda = await panel.locator('body').innerText();
  paso(
    'Panel: la ayuda habla de este negocio',
    ayuda.includes('Registrar una visita') && ayuda.includes(`${codigo.split('-')[0]}-`),
  );
  const nueva = `Sucursal ${Date.now().toString(36)}`;
  await panel.goto(`${BASE}/admin/sucursales`);
  await panel.locator('input[name=nombre]').last().fill(nueva);
  await panel.getByRole('button', { name: 'Crear sucursal' }).click();
  await panel
    .getByText('Sucursal creada')
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await panel.goto(`${BASE}/admin/sucursales`);
  paso(
    'Panel: el dueño abre una sucursal nueva',
    (await panel.locator('body').innerText()).includes(nueva),
  );

  await panel.goto(`${BASE}/admin/lealtad/analitica`);
  await foto(panel, '11-panel-analitica');
  paso('Panel: la analítica abre', /Analítica/i.test(await panel.locator('body').innerText()));
} catch (e) {
  paso('El recorrido terminó sin errores', false, String(e).slice(0, 300));
} finally {
  await navegador.close();
  const mal = pasos.filter((p) => !p.ok).length;
  console.log(`${slug}: ${pasos.length - mal} de ${pasos.length} pasos bien`);
}


/**
 * Apple Wallet de punta a punta contra el servidor, haciendo de iPhone:
 * descarga el pase con la sesión de la tarjeta, lo abre, comprueba la firma y
 * recorre el servicio web de PassKit (registro, cambios, descarga, baja).
 * Requiere un certificado en el servidor; con uno de prueba vale, porque aquí
 * no interviene Apple.
 */
async function probarAppleWallet(cliente) {
  const { execSync } = await import('node:child_process');
  const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const dir = `${carpeta}/pase`;
  mkdirSync(dir, { recursive: true });

  const r = await cliente.request.get(`${BASE}/lealtad/tarjeta/apple-wallet`);
  paso(
    'Wallet: la tarjeta descarga un pase de Apple',
    r.status() === 200 && r.headers()['content-type'] === 'application/vnd.apple.pkpass',
    `${r.status()} ${r.headers()['content-type']}`,
  );
  if (r.status() !== 200) return;
  writeFileSync(`${dir}/tarjeta.pkpass`, await r.body());
  execSync(`cd ${dir} && unzip -o -q tarjeta.pkpass -d abierto`);
  const pase = JSON.parse(readFileSync(`${dir}/abierto/pass.json`, 'utf8'));
  const archivos = execSync(`ls ${dir}/abierto`).toString().split('\n').filter(Boolean);
  paso(
    'Wallet: el pase trae manifiesto, firma e imágenes en tres tamaños',
    ['manifest.json', 'signature', 'icon.png', 'icon@2x.png', 'logo@2x.png', 'strip@2x.png', 'strip@3x.png'].every(
      (a) => archivos.includes(a),
    ),
    archivos.join(' '),
  );
  let firma = '';
  try {
    firma = execSync(
      `cd ${dir}/abierto && openssl smime -verify -binary -inform DER -in signature -content manifest.json -noverify -out /dev/null 2>&1`,
    ).toString();
  } catch (e) {
    firma = String(e.stdout ?? e);
  }
  paso('Wallet: la firma del manifiesto es válida', /Verification successful/i.test(firma), firma.trim().slice(0, 120));
  paso(
    'Wallet: el pase lleva 1 estampa, el QR de la web y el servicio web del negocio',
    /^1 de \d+$/.test(pase.storeCard.headerFields[0].value) &&
      pase.barcodes[0].message.startsWith(`${BASE}/lealtad/t/`) &&
      pase.webServiceURL === `${BASE}/api/wallet/apple`,
    `${pase.storeCard.headerFields[0].value} · ${pase.webServiceURL}`,
  );

  // Hace de iPhone: registra el dispositivo con el token del pase.
  const servicio = `${pase.webServiceURL}/v1`;
  const tipo = pase.passTypeIdentifier;
  const serie = pase.serialNumber;
  const dispositivo = `e2e${Date.now().toString(36)}`;
  const auth = { Authorization: `ApplePass ${pase.authenticationToken}` };
  const pedir = (ruta, o = {}) => cliente.request.fetch(`${servicio}${ruta}`, { failOnStatusCode: false, ...o });

  const sinToken = await pedir(`/passes/${tipo}/${serie}`);
  // El mismo pase, pedido en el servicio web de otro negocio: no debe existir ahí.
  const vecino = slug === 'cafe-demo' ? 'barberia-demo' : 'cafe-demo';
  const otroNegocio = await cliente.request.fetch(
    `${servicio.replace(`/${slug}/`, `/${vecino}/`)}/passes/${tipo}/${serie}`,
    { failOnStatusCode: false, headers: auth },
  );
  paso(
    'Wallet: sin token responde 401 y otro negocio no puede leer este pase',
    sinToken.status() === 401 && otroNegocio.status() === 401,
    `${sinToken.status()} ${otroNegocio.status()}`,
  );

  const alta = await pedir(`/devices/${dispositivo}/registrations/${tipo}/${serie}`, {
    method: 'POST',
    headers: auth,
    data: { pushToken: 'a'.repeat(64) },
  });
  const cambios = await pedir(`/devices/${dispositivo}/registrations/${tipo}`);
  const lista = cambios.status() === 200 ? await cambios.json() : null;
  paso(
    'Wallet: el iPhone se registra y el servicio le dice qué pase cambió',
    alta.status() === 201 && Boolean(lista?.serialNumbers?.includes(serie)),
    `${alta.status()} ${cambios.status()}`,
  );

  const fresco = await pedir(`/passes/${tipo}/${serie}`, { headers: auth });
  const sinCambio = await pedir(`/passes/${tipo}/${serie}`, {
    headers: { ...auth, 'If-Modified-Since': fresco.headers()['last-modified'] ?? '' },
  });
  paso(
    'Wallet: entrega el pase al iPhone y responde 304 si no hay cambios',
    fresco.status() === 200 && sinCambio.status() === 304,
    `${fresco.status()} ${sinCambio.status()}`,
  );

  const baja = await pedir(`/devices/${dispositivo}/registrations/${tipo}/${serie}`, {
    method: 'DELETE',
    headers: auth,
  });
  const trasBaja = await pedir(`/devices/${dispositivo}/registrations/${tipo}`);
  paso(
    'Wallet: al quitar el pase, el iPhone deja de estar registrado',
    baja.status() === 200 && trasBaja.status() === 404,
    `${baja.status()} ${trasBaja.status()}`,
  );
}
