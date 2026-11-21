import { Icono } from '@/components/lealtad/Iconos';

interface Paso {
  readonly titulo: string;
  readonly texto: string;
  readonly href: string;
  readonly hecho: boolean;
  readonly nuevaPestana?: boolean;
}

/**
 * Lista de arranque para el dueño de un club recién creado. Cada paso marca
 * solo cuando se cumple; desaparece cuando están todos.
 */
export function PrimerosPasos({
  diasPrueba,
  tarjetas,
  visitas,
  unete,
  conDatos,
}: {
  /** Días de prueba que quedan; null si el club no está en prueba. */
  diasPrueba: number | null;
  tarjetas: number;
  visitas: number;
  /** Dirección donde los clientes sacan su tarjeta. */
  unete: string;
  /** ¿Ya tiene domicilio y contacto para sus términos y aviso? */
  conDatos: boolean;
}) {
  const pasos: Paso[] = [
    {
      titulo: 'Saca tu propia tarjeta',
      texto: 'Ábrela en tu celular, como lo hará tu cliente.',
      href: unete,
      hecho: tarjetas > 0,
      nuevaPestana: true,
    },
    {
      titulo: 'Súmate tu primera estampa',
      texto: 'En Caja, escanea el código de tu tarjeta y toca «Sumar estampa».',
      href: '/admin/lealtad/caja',
      hecho: visitas > 0,
    },
    {
      titulo: 'Pon tu cartel donde cobras',
      texto: 'Imprímelo: tus clientes lo escanean y sacan su tarjeta solos.',
      href: '/admin/lealtad/sucursales/cartel/principal',
      hecho: tarjetas > 1,
    },
    {
      titulo: 'Completa tus datos',
      texto: 'Tu logotipo, contacto y domicilio. Salen en las reglas de tu programa.',
      href: '/admin/marca',
      hecho: conDatos,
    },
  ];
  const listos = pasos.filter((p) => p.hecho).length;
  if (listos === pasos.length) return null;

  return (
    <section className="mb-8 grid gap-4 rounded-xl border border-rule bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl text-ink">Arranca tu club</h2>
        <span className="text-[14px] text-muted">
          {listos} de {pasos.length} listos
          {diasPrueba !== null
            ? ` · ${diasPrueba === 1 ? 'queda 1 día' : `quedan ${diasPrueba} días`} de prueba`
            : ''}
        </span>
      </div>
      <ol className="grid gap-2">
        {pasos.map((p, i) => (
          <li key={p.titulo}>
            <a
              href={p.href}
              target={p.nuevaPestana ? '_blank' : undefined}
              className="flex items-start gap-4 rounded-lg px-3 py-3 hover:bg-cream"
            >
              <span
                aria-hidden="true"
                className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[15px] font-semibold ${p.hecho ? 'bg-disponible text-white' : 'border border-ink text-ink'}`}
              >
                {p.hecho ? <Icono nombre="palomita" width={18} height={18} /> : i + 1}
              </span>
              <span className="grid gap-0.5">
                <b className={`font-semibold ${p.hecho ? 'text-muted line-through' : 'text-ink'}`}>
                  {p.titulo}
                </b>
                <span className="text-[14px] text-muted">
                  {p.hecho ? 'Listo.' : p.texto}
                  <span className="sr-only">{p.hecho ? ' (hecho)' : ' (pendiente)'}</span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
