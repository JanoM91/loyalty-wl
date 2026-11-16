'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { extraerCodigoTarjeta } from '@wl/domain';
import { useMarca } from '@/components/Marca';

/**
 * Lector del código de la tarjeta con la cámara de la tableta.
 *
 * Lee cuadro por cuadro con jsQR, que funciona en cualquier navegador (el
 * lector nativo `BarcodeDetector` no existe en Safari). Se detiene en cuanto
 * encuentra un código válido y libera la cámara al salir de la pantalla.
 *
 * Si no hay cámara, o la persona no da permiso, la pantalla de arriba sigue
 * ofreciendo escribir el código o usar un lector USB.
 */
export function Escaner({ alLeer }: { alLeer: (codigo: string) => void }) {
  // En una referencia: el lector corre en un ciclo que no se reinicia.
  const prefijo = useRef(useMarca().prefijoCodigo);
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<'iniciando' | 'leyendo' | 'sin-camara'>('iniciando');
  const leido = useRef(false);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let cuadro = 0;
    let vivo = true;
    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado('sin-camara');
        return;
      }
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        });
        if (!vivo || !video.current) return;
        video.current.srcObject = flujo;
        await video.current.play();
        setEstado('leyendo');
        cuadro = requestAnimationFrame(leer);
      } catch {
        setEstado('sin-camara');
      }
    }

    function leer() {
      const v = video.current;
      if (!vivo || !v || !ctx || leido.current) return;
      if (v.readyState === v.HAVE_ENOUGH_DATA) {
        // Se analiza una versión reducida: el QR ocupa buena parte del cuadro
        // y a 480 px se lee igual de bien, con una fracción del trabajo.
        const escala = Math.min(1, 480 / v.videoWidth);
        lienzo.width = Math.round(v.videoWidth * escala);
        lienzo.height = Math.round(v.videoHeight * escala);
        ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
        const imagen = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
        const qr = jsQR(imagen.data, imagen.width, imagen.height, {
          inversionAttempts: 'dontInvert',
        });
        const codigo = qr ? extraerCodigoTarjeta(qr.data, prefijo.current) : null;
        if (codigo) {
          leido.current = true;
          navigator.vibrate?.(60);
          alLeer(codigo);
          return;
        }
      }
      cuadro = requestAnimationFrame(leer);
    }

    void iniciar();
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [alLeer]);

  return (
    <div className="relative grid aspect-[4/3] w-full max-w-full place-items-center overflow-hidden rounded-lg bg-[#1c1611] text-center text-cream">
      <video
        ref={video}
        muted
        playsInline
        className={`absolute inset-0 h-full w-full object-cover ${estado === 'leyendo' ? '' : 'hidden'}`}
      />
      <div aria-hidden="true" className="absolute inset-[14%]">
        <b className="absolute top-0 left-0 h-8 w-8 rounded-tl-xl border-t-[3px] border-l-[3px] border-crust-light" />
        <b className="absolute top-0 right-0 h-8 w-8 rounded-tr-xl border-t-[3px] border-r-[3px] border-crust-light" />
        <b className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-crust-light" />
        <b className="absolute right-0 bottom-0 h-8 w-8 rounded-br-xl border-r-[3px] border-b-[3px] border-crust-light" />
      </div>
      <p className="relative z-10 max-w-[26ch] text-sm text-cream/90">
        {estado === 'iniciando' && 'Abriendo la cámara…'}
        {estado === 'leyendo' && ''}
        {estado === 'sin-camara' &&
          'No hay cámara disponible o no se dio permiso. Escribe el código abajo o usa el lector.'}
      </p>
      <span className="absolute right-0 bottom-2.5 left-0 z-10 text-xs text-cream/75">
        {estado === 'leyendo'
          ? 'Apunta al código de la tarjeta'
          : 'También funciona con lector de códigos'}
      </span>
    </div>
  );
}
