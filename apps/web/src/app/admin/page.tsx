import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  ROLES_DIRECCION,
  estadoComercialDe,
  listarUsuarios,
  prisma,
  programaVigente,
  resumenLealtad,
} from '@wl/database';
import { diasRestantesDePrueba, fechaDeBorrado } from '@wl/domain';

import { AvisoClub } from '@/components/admin/AvisoClub';
import { Constelacion } from '@/components/admin/constelacion/Constelacion';
import type { DatosMapa, PasoArranque } from '@/components/admin/constelacion/tipos';
import { comandosDelPanel } from '@/lib/admin/panel';
import { exigirSesion } from '@/lib/admin/sesion';
import { enlaceWhatsAppServicio } from '@/lib/contacto';
import { qrSvg, urlAfiliacion } from '@/lib/lealtad/qr';
import { exigirNegocio, rutaBase, ruta, sitioDeLaPeticion } from '@/lib/negocio';

export const metadata: Metadata = { title: 'Tu club' };
export const dynamic = 'force-dynamic';

const ROL_VISIBLE: Record<string, string> = {
  ADMIN: 'administración',
  DUENO: 'dueño',
  GERENTE: 'gerente',
  SUCURSAL: 'caja',
  MARKETING: 'marketing',
  LECTOR: 'lectura',
};

const fecha = (d: Date) =>
  d.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long' });

/**
 * Inicio del panel: el mapa del club («Constelación»). Las cuentas de caja no
 * llegan aquí (`exigirSesion()` las manda a la caja); los roles sin acceso al
 * programa van a la ayuda.
 */
export default async function AdminInicioPage() {
  const sesion = await exigirSesion();
  if (!ROLES_DIRECCION.includes(sesion.rol)) redirect(await ruta('/admin/ayuda'));
  const administra = sesion.rol === 'ADMIN' || sesion.rol === 'DUENO';

  const [negocio, base, programa, r, sucursales, sitio] = await Promise.all([
    exigirNegocio(),
    rutaBase(),
    programaVigente(),
    resumenLealtad(7),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, loyaltyEnabled: true },
    }),
    sitioDeLaPeticion(),
  ]);
  const usuarios = administra ? await listarUsuarios() : [];
  const primera = sucursales.find((s) => s.loyaltyEnabled) ?? sucursales[0] ?? null;
  const unete = primera ? await urlAfiliacion(primera.slug) : `${base}/lealtad`;
  const qr = primera ? await qrSvg(unete, '#06231C') : null;

  // Estado comercial: prueba, pausa o pago.
  const { pruebaVence, pagadoHasta, alta } = negocio.ajustes;
  const comercial = estadoComercialDe(negocio);
  const activar = enlaceWhatsAppServicio(
    `Hola, quiero activar el club de ${negocio.nombre} (${sitio}).`,
  );
  let estado: DatosMapa['estado'] = { texto: 'Activo', pausa: false, activar: null };
  if (comercial === 'PRUEBA') {
    const dias = diasRestantesDePrueba(pruebaVence);
    estado = {
      texto: dias === 1 ? 'Prueba: queda 1 día' : `Prueba: quedan ${dias} días`,
      pausa: false,
      activar,
    };
  } else if (comercial === 'PAUSADO') {
    const borrar = fechaDeBorrado(pruebaVence, pagadoHasta);
    estado = {
      texto: borrar ? `En pausa · se guarda hasta el ${fecha(borrar)}` : 'En pausa',
      pausa: true,
      activar,
    };
  } else if (pagadoHasta) {
    estado = {
      texto: `Activo hasta el ${fecha(new Date(pagadoHasta))}`,
      pausa: false,
      activar: null,
    };
  }

  const hoy = r.porDia[r.porDia.length - 1];
  const { legal, contacto } = negocio.marca;
  const marcaPendiente = [
    !negocio.marca.logoUrl && !negocio.marca.logoClaroUrl ? 'Falta tu logotipo' : null,
    !legal.domicilio ? 'Falta tu domicilio' : null,
    !contacto.correo && !contacto.whatsapp ? 'Falta tu contacto' : null,
  ].filter((x): x is string => x !== null);

  let arranque: PasoArranque[] | null = null;
  if (alta) {
    arranque = [
      {
        titulo: 'Saca tu propia tarjeta',
        texto: 'Ábrela en tu celular, como lo hará tu cliente.',
        href: unete,
        hecho: r.tarjetas > 0,
        nuevaPestana: true,
      },
      {
        titulo: 'Súmate tu primer sello',
        texto: 'En la caja, escanea tu tarjeta y toca «Sumar sello».',
        href: `${base}/admin/lealtad/caja`,
        hecho: r.visitas > 0,
      },
      {
        titulo: 'Pon tu cartel donde cobras',
        texto: 'Imprímelo: tus clientes lo escanean y sacan su tarjeta solos.',
        href: primera
          ? `${base}/admin/lealtad/sucursales/cartel/${primera.slug}`
          : `${base}/admin/lealtad/sucursales`,
        hecho: r.tarjetas > 1,
      },
      {
        titulo: 'Completa tus datos',
        texto: 'Logotipo, contacto y domicilio. Salen en las reglas de tu programa.',
        href: `${base}/admin/marca`,
        hecho: marcaPendiente.length === 0,
      },
    ];
    if (arranque.every((p) => p.hecho)) arranque = null;
  }

  const datos: DatosMapa = {
    base,
    slug: negocio.slug,
    rol: sesion.rol,
    administra,
    negocio: {
      nombre: negocio.nombre,
      logoUrl: negocio.marca.logoClaroUrl ?? negocio.marca.logoUrl,
      colores: {
        fondo: negocio.marca.colores.fondo,
        sobre: negocio.marca.colores.sobreFondo,
        acento: negocio.marca.colores.acento,
      },
    },
    estado,
    arranque,
    programa: {
      editable: programa.modalidad === 'VISITA' && programa.hitos.length === 1,
      posiciones: programa.posiciones,
      hitos: [...programa.hitos]
        .sort((a, b) => a.posicion - b.posicion)
        .map((h) => ({ posicion: h.posicion, nombre: h.nombre })),
    },
    numeros: {
      tarjetas: r.tarjetas,
      nuevas: r.tarjetasNuevas,
      activos: r.clientesActivos,
      verificadas: r.verificadas,
      sellosSemana: r.visitas,
      sellosHoy: hoy?.visitas ?? 0,
      premiosListos: r.premiosDisponibles,
      premiosEntregados: r.premiosEntregados,
      pendientes: r.pendientes,
    },
    sucursales: sucursales.map((s) => ({
      slug: s.slug,
      nombre: s.name,
      participa: s.loyaltyEnabled,
    })),
    qr,
    unete,
    marcaPendiente,
    equipo: usuarios
      .filter((u) => u.activo)
      .map((u) => ({
        nombre: u.id === sesion.userId ? 'Tú' : u.nombre || u.email,
        rol: ROL_VISIBLE[u.rol] ?? u.rol,
      })),
  };

  const comandos = comandosDelPanel(sesion.rol)
    .filter((c) => c.id !== 'mapa')
    .map((c) => ({
      id: c.id,
      texto: c.texto,
      grupo: c.grupo,
      claves: c.claves,
      href: `${base}${c.ruta}`,
    }));

  return (
    <>
      <Constelacion datos={datos} comandos={comandos} />
      <div className="pointer-events-none fixed inset-x-0 top-16 z-20 mx-auto max-w-3xl px-5 [&>*]:pointer-events-auto">
        <AvisoClub sesion={sesion} />
      </div>
    </>
  );
}
