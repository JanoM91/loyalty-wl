import { fijarResolutorDeNegocio } from '@wl/database';

import { exigirNegocio } from '@/lib/negocio';

// Toda consulta sale del negocio del subdominio. Si la dirección no es de
// ningún negocio (o está suspendido), la petición termina en 404 en vez de
// consultar nada.
fijarResolutorDeNegocio(exigirNegocio);
