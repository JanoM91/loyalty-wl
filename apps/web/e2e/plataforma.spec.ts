import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const BD = path.resolve(import.meta.dirname, '../../../packages/database');

async function entrar(page: Page, email: string, clave: string) {
  await page.goto('/plataforma/entrar');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/plataforma$/);
}

/**
 * Panel de plataforma: registrar y anular un pago, verlo en Ingresos, invitar
 * a alguien al equipo (que elige su contraseña con su enlace), la bitácora y
 * la descarga de clubes. La cuenta y el club se crean con un atajo de pruebas.
 */
test('plataforma: pago → ingresos → anular → equipo → bitácora → descarga', async ({
  page,
  browser,
  baseURL,
}) => {
  const n = Date.now().toString().slice(-6);
  const email = `plataforma${n}@ejemplo.mx`;
  const clave = 'clave larga de plataforma';
  const slug = `club-plataforma-${n}`;
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/e2e-plataforma.ts', email, clave, slug], {
    cwd: BD,
    stdio: 'pipe',
    env: { ...process.env, WL_PRUEBAS_BD: '1' },
  });

  await entrar(page, email, clave);

  // 1. Pago de un mes desde la ficha: llega con el precio vigente.
  await page.goto(`/plataforma/${slug}`);
  await page.waitForLoadState('networkidle');
  const pago = page.locator('form:has(input[name=concepto][value=LITE])').first();
  await expect(pago.locator('input[name=importe]')).toHaveValue('269');
  await pago.locator('input[name=nota]').fill(`Transferencia E2E ${n}`);
  await pago.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.getByText('Pago registrado. Ya cuenta en Ingresos.')).toBeVisible();
  await expect(page.getByText(`Transferencia E2E ${n}`)).toBeVisible();

  // 2. Ingresos lo cuenta y se puede anular.
  await page.goto('/plataforma/ingresos');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(`Transferencia E2E ${n}`)).toBeVisible();
  const renglon = page.locator('li', { hasText: `Transferencia E2E ${n}` });
  await renglon.getByText('Anular este pago').click();
  await renglon.getByRole('button', { name: 'Sí, anular' }).click();
  await expect(page.getByText(/^Pago anulado/)).toBeVisible();

  // 3. Invitar a alguien: elige su contraseña con el enlace y entra.
  await page.goto('/plataforma/equipo');
  await page.waitForLoadState('networkidle');
  const invitar = page.locator('form:has(input[name=porCorreo])');
  await invitar.getByLabel('Nombre').fill('Invitada E2E');
  await invitar.getByLabel('Correo', { exact: true }).fill(`invitada${n}@ejemplo.mx`);
  await invitar.getByLabel('Mandarle el enlace por correo').uncheck();
  await invitar.getByRole('button', { name: 'Invitar' }).click();
  const enlace = (await invitar.locator('code').innerText()).trim();
  expect(enlace).toContain('/plataforma/contrasena/');

  const otra = await browser.newContext({ baseURL });
  const invitada = await otra.newPage();
  await invitada.goto(new URL(enlace).pathname);
  await invitada.waitForLoadState('networkidle');
  await invitada.getByLabel('Contraseña nueva').fill('otra clave larga e2e');
  await invitada.getByLabel('Escríbela otra vez').fill('otra clave larga e2e');
  await invitada.getByRole('button', { name: 'Guardar y entrar' }).click();
  await expect(invitada.getByText('Tu contraseña quedó guardada')).toBeVisible();
  await entrar(invitada, `invitada${n}@ejemplo.mx`, 'otra clave larga e2e');
  await otra.close();

  // 4. La bitácora anota lo que pasó, con el club.
  await page.goto('/plataforma/bitacora');
  for (const texto of ['Registró un pago', 'Anuló un pago', 'Invitó a una persona al equipo']) {
    await expect(page.getByText(texto).first()).toBeVisible();
  }

  // 5. La lista de clubes se descarga para Excel.
  await page.goto('/plataforma?vista=clubes');
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Descargar' }).click(),
  ]);
  const archivo = readFileSync((await descarga.path())!, 'utf8');
  expect(archivo.charCodeAt(0)).toBe(0xfeff);
  expect(archivo).toContain(`Club ${slug}`);
});
