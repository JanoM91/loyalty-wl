/**
 * Lo que el servidor le pasa al mapa del club. Todo serializable: el mapa es
 * un componente de cliente y no consulta la base por su cuenta.
 */

export interface PasoArranque {
  readonly titulo: string;
  readonly texto: string;
  readonly href: string;
  readonly hecho: boolean;
  readonly nuevaPestana?: boolean;
}

export interface DatosMapa {
  /** Tramo del negocio en la dirección: «/barberia-leon» o «». */
  readonly base: string;
  readonly slug: string;
  readonly rol: string;
  readonly administra: boolean;
  readonly negocio: {
    readonly nombre: string;
    readonly logoUrl: string | null;
    readonly colores: { readonly fondo: string; readonly sobre: string; readonly acento: string };
  };
  /** Prueba, pausa o pago. */
  readonly estado: {
    readonly texto: string;
    readonly pausa: boolean;
    /** WhatsApp para activar o renovar; null si el club no lo necesita. */
    readonly activar: string | null;
  };
  /** Pasos de arranque; null si el club no viene del asistente o ya los cumplió. */
  readonly arranque: readonly PasoArranque[] | null;
  readonly programa: {
    readonly posiciones: number;
    readonly hitos: readonly { readonly posicion: number; readonly nombre: string }[];
  };
  readonly numeros: {
    readonly tarjetas: number;
    readonly nuevas: number;
    readonly activos: number;
    readonly verificadas: number;
    readonly sellosSemana: number;
    readonly sellosHoy: number;
    readonly premiosListos: number;
    readonly premiosEntregados: number;
    readonly pendientes: number;
  };
  readonly sucursales: readonly {
    readonly slug: string;
    readonly nombre: string;
    readonly participa: boolean;
  }[];
  /** QR para unirse en la primera sucursal (SVG). */
  readonly qr: string | null;
  readonly unete: string;
  readonly marcaPendiente: readonly string[];
  readonly equipo: readonly { readonly nombre: string; readonly rol: string }[];
}
