/**
 * Archivos CSV que abren bien en Excel (en español): UTF-8 con BOM, comas,
 * comillas cuando hacen falta y renglones con CRLF.
 *
 * Una celda que empieza con `=`, `+`, `-`, `@`, tabulador o retorno se
 * antepone con un apóstrofo: así Excel no la interpreta como fórmula (un
 * nombre de cliente como «=HYPERLINK(…)» no se ejecuta al abrir el archivo).
 */

const PELIGROSO = /^[=+\-@\t\r]/;

export function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  let texto: string;
  if (valor instanceof Date) texto = Number.isNaN(valor.getTime()) ? '' : fechaCsv(valor);
  else if (typeof valor === 'number') texto = Number.isFinite(valor) ? String(valor) : '';
  else if (typeof valor === 'boolean') texto = valor ? 'Sí' : 'No';
  else texto = String(valor);
  if (typeof valor === 'string' && PELIGROSO.test(texto)) texto = `'${texto}`;
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** «2026-11-24 13:05», en la zona dada (por omisión, centro de México). */
export function fechaCsv(d: Date, zona = 'America/Mexico_City'): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function armarCsv(
  encabezados: readonly string[],
  filas: readonly (readonly unknown[])[],
): string {
  const renglones = [encabezados, ...filas].map((f) => f.map(celdaCsv).join(','));
  return `\uFEFF${renglones.join('\r\n')}\r\n`;
}

/** Respuesta de descarga: sin caché (lleva datos personales) y con nombre de archivo. */
export function descargaCsv(nombre: string, contenido: string): Response {
  const seguro = nombre.replace(/[^a-z0-9._-]/gi, '-');
  return new Response(contenido, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${seguro}"`,
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** «2026-11-24», para el nombre del archivo. */
export function hoyParaArchivo(zona = 'America/Mexico_City'): string {
  return fechaCsv(new Date(), zona).slice(0, 10);
}
