import type { Metadata } from 'next';
import { formatoCelular } from '@wl/domain';

import { NavTarjeta } from '@/components/lealtad/NavTarjeta';
import { Icono } from '@/components/lealtad/Iconos';
import { urlPersonalDeTarjeta } from '@/lib/lealtad/enlace-personal';
import { exigirTarjeta } from '@/lib/lealtad/sesion';
import { EnlacePersonal } from './EnlacePersonal';
import { salir } from '../acciones';
import { Aviso } from '@/components/lealtad/Aviso';
import { AvisoContrasena } from '@/components/lealtad/AvisoContrasena';
import {
  FormularioCelular,
  FormularioContrasena,
  FormularioCorreo,
  FormularioPerfil,
} from './Formularios';

export const metadata: Metadata = { title: 'Perfil' };
export const dynamic = 'force-dynamic';

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ verificada?: string }>;
}) {
  const t = await exigirTarjeta();
  const [{ verificada }, enlace] = await Promise.all([searchParams, urlPersonalDeTarjeta(t.id)]);
  const completo = [t.correo, t.celular, t.nombre, t.cumpleDia].filter(Boolean).length;
  const porcentaje = Math.round((completo / 4) * 100);

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl text-ink">Perfil y preferencias</h1>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-rule"
          role="progressbar"
          aria-valuenow={porcentaje}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Perfil completo"
        >
          <i
            className="block h-full rounded-full bg-disponible"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <p className="text-xs text-muted">
          Perfil al {porcentaje} %. Completarlo es opcional: tus sellos cuentan igual.
        </p>
      </div>

      <AvisoContrasena tiene={t.tieneContrasena} />

      <FormularioPerfil
        nombre={t.nombre ?? ''}
        dia={t.cumpleDia}
        mes={t.cumpleMes}
        promociones={t.promociones}
        medio={t.correo ? 'correo' : 'mensaje'}
      />

      <section id="correo" className="grid gap-3 border-t border-rule pt-5">
        <h2 className="text-lg text-ink">Contacto</h2>
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-cream text-sm">
          {t.celular && (
            <li className="flex items-center gap-3 px-3.5 py-3">
              <Icono nombre="tarjeta" className="text-ink-soft" />
              <span className="min-w-0 flex-1 font-mono">{formatoCelular(t.celular)}</span>
              {t.celularVerificado ? (
                <span className="rounded-full bg-disponible/10 px-2.5 py-0.5 text-xs font-semibold text-disponible">
                  Verificado
                </span>
              ) : (
                <span className="text-xs text-muted">Sin verificar</span>
              )}
            </li>
          )}
          {t.correo && (
            <li className="flex items-center gap-3 px-3.5 py-3">
              <Icono nombre="correo" className="text-ink-soft" />
              <span className="min-w-0 flex-1 truncate font-mono">{t.correo}</span>
              {t.correoVerificado ? (
                <span className="rounded-full bg-disponible/10 px-2.5 py-0.5 text-xs font-semibold text-disponible">
                  Verificado
                </span>
              ) : (
                <a
                  href="/lealtad/verificar"
                  className="text-xs font-semibold text-crust-dark underline"
                >
                  Verificar
                </a>
              )}
            </li>
          )}
        </ul>
        <div className="grid gap-5">
          {!t.correo && <FormularioCorreo actual={t.correo} />}
          {!t.celular && <FormularioCelular actual={t.celular} />}
          {(t.correo || t.celular) && (
            <details className="text-sm">
              <summary className="cursor-pointer text-crust-dark underline underline-offset-4">
                {t.correo && t.celular
                  ? 'Cambiar mi correo o mi celular'
                  : t.correo
                    ? 'Cambiar mi correo'
                    : 'Cambiar mi celular'}
              </summary>
              <div className="mt-4 grid gap-5">
                {t.correo && <FormularioCorreo actual={t.correo} />}
                {t.celular && <FormularioCelular actual={t.celular} />}
              </div>
            </details>
          )}
        </div>
      </section>

      {enlace && (
        <section id="enlace" className="grid gap-3 border-t border-rule pt-5">
          <h2 className="text-lg text-ink">Tu enlace personal</h2>
          <p className="text-sm text-ink-soft">
            Abre tu tarjeta siempre, en cualquier celular y sin contraseña. También está en el
            reverso de tu tarjeta en Wallet. Es personal: no lo compartas.
          </p>
          <EnlacePersonal url={enlace} />
        </section>
      )}

      <section id="contrasena" className="grid gap-3 border-t border-rule pt-5">
        <h2 className="text-lg text-ink">
          {t.tieneContrasena ? 'Cambiar contraseña' : 'Contraseña (opcional)'}
        </h2>
        <p className="text-sm text-ink-soft">
          Una sola contraseña para entrar con tu correo o con tu celular, desde cualquier celular.
          {t.tieneContrasena ? ' Al cambiarla, cerramos tu tarjeta en los demás celulares.' : ''}
        </p>
        {verificada && t.correoVerificado && !t.tieneContrasena && (
          <Aviso tono="ok" titulo="Tu correo quedó confirmado">
            Si quieres, crea una contraseña para entrar también con tu correo o tu celular.
          </Aviso>
        )}
        <FormularioContrasena tiene={t.tieneContrasena} usuario={t.correo ?? t.celular} />
      </section>

      <section className="grid gap-2 border-t border-rule pt-5 text-sm text-ink-soft">
        <p>
          Guardamos cada permiso con su fecha y la versión del texto que aceptaste. Puedes darte de
          baja de las promociones cuando quieras; los avisos de tu tarjeta (premios y verificación)
          siempre llegan.
        </p>
        <p className="font-mono text-xs text-muted">Tarjeta {t.codigo}</p>
        <form action={salir}>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm text-crust-dark underline underline-offset-4"
          >
            <Icono nombre="salir" width={16} height={16} />
            Cerrar sesión en este celular
          </button>
        </form>
      </section>

      <NavTarjeta
        actual="/lealtad/perfil"
        premiosListos={t.premios.filter((p) => p.disponible).length}
      />
    </>
  );
}
