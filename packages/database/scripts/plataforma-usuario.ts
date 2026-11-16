/**
 * Crea una cuenta del panel de plataforma, o le cambia la contraseña.
 *
 *     pnpm --filter @wl/database plataforma:usuario <correo> "<nombre>"
 *
 * **La contraseña se teclea aquí y no viaja a ningún lado.** No se pasa como
 * argumento (quedaría en el historial de la terminal), no se imprime y solo se
 * guarda su hash. Necesita DIRECT_URL (rol dueño).
 */
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

import { crearUsuarioPlataforma, desconectarPlataforma } from '../src/index';

const [email, nombre] = process.argv.slice(2);
if (!email) {
  console.error('Uso: plataforma:usuario <correo> "<nombre>"');
  process.exit(1);
}

/** Lee una línea sin mostrarla en pantalla. */
function preguntarOculto(texto: string): Promise<string> {
  return new Promise((resolver) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
    const salida = rl as unknown as { _writeToOutput: (s: string) => void };
    stdout.write(texto);
    if (stdin.isTTY) salida._writeToOutput = () => undefined;
    rl.question('', (respuesta) => {
      rl.close();
      stdout.write('\n');
      resolver(respuesta);
    });
  });
}

const clave = await preguntarOculto('Contraseña (mínimo 10 caracteres, no se muestra): ');
const r = await crearUsuarioPlataforma({ email, nombre: nombre ?? email, clave });
if (!r.ok) {
  console.error(r.error);
  process.exitCode = 1;
} else {
  console.warn(`Listo: ${email} ya puede entrar en /plataforma/entrar.`);
}
await desconectarPlataforma();
