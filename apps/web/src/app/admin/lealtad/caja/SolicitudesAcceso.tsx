'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Aviso } from '@/components/lealtad/Aviso';
import { Icono } from '@/components/lealtad/Iconos';
import { descartarSolicitud, enviarEnlacePorWhatsApp } from './solicitudes';

export interface FilaSolicitud {
  readonly id: string;
  readonly nombre: string | null;
  /** Enmascarado: la caja no necesita ver el número completo. */
  readonly celular: string;
  readonly hace: string;
  /** Solo para Administración, Dueño y Gerencia, que ven todas las sucursales. */
  readonly sucursal: string | null;
}

/**
 * «Solicitudes de acceso (n)» en la caja.
 *
 * Cada fila es alguien que tocó «Olvidé mi contraseña» y solo dejó celular.
 * «Enviar enlace por WhatsApp» genera un enlace de un solo uso (24 h) y abre
 * WhatsApp con el mensaje escrito, dirigido al celular registrado de la
 * tarjeta: aquí no se escribe ni se cambia el número.
 *
 * La pestaña de WhatsApp se abre antes de esperar al servidor: Safari del
 * iPad bloquea las ventanas que se abren después de una espera.
 */
export function SolicitudesAcceso({
  filas,
  verSucursal,
}: {
  filas: readonly FilaSolicitud[];
  verSucursal: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string; url?: string } | null>(
    null,
  );
  const [, startTransition] = useTransition();

  if (filas.length === 0 && !aviso) return null;

  async function enviar(f: FilaSolicitud) {
    setOcupado(f.id);
    setAviso(null);
    const ventana = window.open('', '_blank');
    const r = await enviarEnlacePorWhatsApp(f.id);
    setOcupado(null);
    if (!r.ok || !r.whatsapp) {
      ventana?.close();
      setAviso({ tono: 'error', texto: r.ok ? 'No se pudo preparar el enlace.' : r.error });
      return;
    }
    if (ventana) {
      ventana.opener = null;
      ventana.location.href = r.whatsapp;
    }
    setAviso({
      tono: 'ok',
      texto: `Enlace listo para ${f.nombre ?? 'el cliente'} (${f.celular}). Envíalo en WhatsApp.`,
      url: ventana ? undefined : r.whatsapp,
    });
    startTransition(() => router.refresh());
  }

  async function descartar(f: FilaSolicitud) {
    setOcupado(f.id);
    setAviso(null);
    const r = await descartarSolicitud(f.id);
    setOcupado(null);
    if (!r.ok) setAviso({ tono: 'error', texto: r.error });
    startTransition(() => router.refresh());
  }

  const avisoVista = aviso && (
    <Aviso tono={aviso.tono}>
      {aviso.texto}{' '}
      {aviso.url && (
        <a
          href={aviso.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
        >
          Abrir WhatsApp
        </a>
      )}
    </Aviso>
  );

  // Ya no quedan solicitudes: solo el resultado de la última acción.
  if (filas.length === 0) return avisoVista;

  return (
    <section className="grid gap-2 rounded-md border border-rule bg-cream px-3.5 py-3">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex items-center gap-2 text-left text-sm font-semibold text-ink"
      >
        <Icono nombre="candado" className="text-vuelve" />
        <span className="flex-1">Solicitudes de acceso ({filas.length})</span>
        <span className="text-xs font-normal text-crust-dark underline underline-offset-4">
          {abierto ? 'Ocultar' : 'Ver'}
        </span>
      </button>

      {avisoVista}

      {abierto && (
        <>
          <p className="text-xs text-muted">
            Clientes que olvidaron su contraseña y solo tienen celular. El enlace va al celular
            registrado de su tarjeta, sirve una vez y vence en 24 horas. Pídeles que lo abran en
            Safari o Chrome.
          </p>
          <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-white">
            {filas.map((f) => (
              <li key={f.id} className="grid gap-2 px-3.5 py-3 text-sm sm:flex sm:items-center">
                <span className="min-w-0 flex-1">
                  <b className="block font-semibold text-ink">{f.nombre ?? 'Sin nombre'}</b>
                  <span className="font-mono text-xs text-ink-soft">{f.celular}</span>
                  <span className="text-xs text-muted">
                    {' '}
                    · {f.hace}
                    {verSucursal && f.sucursal ? ` · ${f.sucursal}` : ''}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => enviar(f)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-[#1f8f5a] px-4 font-semibold text-cream hover:bg-[#19764a] disabled:opacity-50"
                  >
                    {ocupado === f.id ? 'Preparando…' : 'Enviar enlace por WhatsApp'}
                  </button>
                  <button
                    type="button"
                    disabled={ocupado !== null}
                    onClick={() => descartar(f)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-rule px-4 text-ink-soft hover:border-ink disabled:opacity-50"
                  >
                    Descartar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
