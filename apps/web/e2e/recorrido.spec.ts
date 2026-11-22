import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const BD = path.resolve(import.meta.dirname, '../../../packages/database');

/**
 * El recorrido que importa, de punta a punta: un dueño crea su club en el
 * asistente, entra a su panel, un cliente saca su tarjeta desde la portada del
 * QR, la caja le suma su primera visita y le entrega su premio. Corre en cada
 * PR contra una base vacía; si se rompe, no se fusiona.
 *
 * Una tarjeta gana un sello por día, así que para llegar al premio se usa el
 * atajo de `packages/database/scripts/e2e-completar.ts` (solo pruebas).
 */
test('alta → panel → tarjeta del cliente → caja suma la visita → premio', async ({
  page,
  browser,
  baseURL,
}) => {
  const n = Date.now().toString().slice(-6);
  const club = `Barbería Recorrido ${n}`;

  // 1. El dueño crea su club.
  await page.goto('/empezar');
  await page.waitForLoadState('networkidle');
  await page.fill('#alta-nombre', club);
  await page.click('button.ch:has-text("Barbería")');
  await page.click('button[type=submit]:has-text("Siguiente")');
  await page.click('button[type=submit]:has-text("Siguiente")');
  await page.fill('#alta-duenio', 'Ana Recorrido');
  await page.fill('#alta-whatsapp', `228${n}7`);
  await page.fill('#alta-correo', `duenio${n}@ejemplo.mx`);
  await page.fill('#alta-clave', 'clave larga del recorrido');
  await page.click('button[type=submit]:has-text("Crear mi club")');
  await page.waitForURL(/\/listo/, { timeout: 60_000 });
  const slug = new URL(page.url()).searchParams.get('n');
  expect(slug, 'la página final trae la dirección del club').toBeTruthy();

  // 2. Entra a su panel (la sesión queda abierta desde el alta).
  await page.goto(`/${slug}/admin`);
  await expect(page.getByText(club).filter({ visible: true }).first()).toBeVisible();

  // 3. Un cliente escanea el QR y saca su tarjeta en su celular.
  const cliente = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'es-MX',
  });
  const tel = await cliente.newPage();
  await tel.goto(`/${slug}/lealtad`);
  await tel.getByRole('link', { name: 'Crear mi tarjeta' }).first().click();
  // Se espera a que la página responda: antes, lo escrito no llega al formulario.
  await tel.waitForLoadState('networkidle');
  await tel.getByRole('button', { name: 'Correo' }).click();
  await tel.fill('#contacto', `cliente${n}@ejemplo.mx`);
  await tel.check('input[name=terminos]');
  const crear = tel.getByRole('button', { name: 'Crear mi tarjeta' });
  await expect(crear).toBeEnabled();
  await crear.click();
  await expect(tel.getByText('Tu tarjeta está lista')).toBeVisible();
  const codigo = (
    await tel.getByLabel(/Código QR de la tarjeta/).getAttribute('aria-label')
  )?.replace('Código QR de la tarjeta ', '');
  expect(codigo, 'la tarjeta muestra su código').toBeTruthy();

  // 4. La caja le suma su primera visita.
  await page.goto(`/${slug}/admin/lealtad/caja`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Sumar sello de visita/ }).click();
  await page.fill('#codigo', codigo!);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: /Sumar sello/ }).click();
  await expect(page.getByText('+1')).toBeVisible();

  // 5. Su tarjeta ya lo muestra.
  await tel.goto(`/${slug}/lealtad/tarjeta`);
  await expect(tel.getByText('Te faltan 4 sellos', { exact: false })).toBeVisible();

  // 6. Atajo de pruebas: los sellos que faltan para el premio y contacto verificado.
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/e2e-completar.ts', slug!, codigo!], {
    cwd: BD,
    stdio: 'pipe',
  });
  await tel.goto(`/${slug}/lealtad/premios`);
  await expect(tel.getByText('Disponible').first()).toBeVisible();

  // 7. La caja entrega el premio y el cliente lo ve entregado.
  await page.goto(`/${slug}/admin/lealtad/caja`);
  await page.waitForLoadState('networkidle');
  await page
    .getByRole('button', { name: /^Entregar premio/ })
    .first()
    .click();
  await page.fill('#codigo', codigo!);
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page
    .getByRole('button', { name: /Entregar premio/ })
    .last()
    .click();
  await page.getByLabel(/Confirmo que entregué/).check();
  await page.getByRole('button', { name: /Confirmar entrega/ }).click();
  await expect(page.getByText(/entregad/i).first()).toBeVisible();
  await tel.goto(`/${slug}/lealtad/premios`);
  await expect(tel.getByText('Ya entregados')).toBeVisible();
  await cliente.close();
});
