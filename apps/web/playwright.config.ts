import { defineConfig } from '@playwright/test';

/**
 * Recorrido completo en un navegador (ver `e2e/`). En CI levanta la versión
 * ya construida con `next start`; en local se puede apuntar a un servidor que
 * ya corre con `WL_E2E_URL=http://localhost:3200`.
 */
const PUERTO = Number(process.env.WL_E2E_PUERTO ?? 3100);
const URL_BASE = process.env.WL_E2E_URL ?? `http://localhost:${PUERTO}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: URL_BASE,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.WL_E2E_URL
    ? undefined
    : {
        command: `pnpm exec next start -p ${PUERTO}`,
        url: `${URL_BASE}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
