'use client';
import { useEffect, useRef, useState } from 'react';
import { vibrar } from '@/lib/format';

type Controls = { stop: () => void };

/** Escáner de pantalla completa. Lee códigos de barras y QR en vivo; también acepta captura manual. */
export function Scanner({
  titulo,
  contador,
  ultimo,
  onCodigo,
  onCerrar,
  unaVez,
}: {
  titulo: string;
  contador?: number;
  ultimo?: string;
  onCodigo: (texto: string, manual: boolean) => void;
  onCerrar: () => void;
  unaVez?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const ctrl = useRef<Controls | null>(null);
  const ult = useRef({ t: '', at: 0 });
  const cb = useRef(onCodigo);
  cb.current = onCodigo;
  const [manual, setManual] = useState('');
  const [errorCam, setErrorCam] = useState('');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150 });
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          video.current!,
          (res) => {
            if (!res || !vivo) return;
            const t = res.getText();
            const now = Date.now();
            if (t === ult.current.t && now - ult.current.at < 4000) return;
            ult.current = { t, at: now };
            vibrar(40);
            setFlash(true); setTimeout(() => setFlash(false), 350);
            cb.current(t, false);
          }
        );
        if (!vivo) c.stop(); else ctrl.current = c;
      } catch (e: any) {
        setErrorCam('No se pudo abrir la cámara. Escribe el código abajo.');
      }
    })();
    return () => { vivo = false; ctrl.current?.stop(); };
  }, []);

  const enviar = () => {
    const v = manual.trim();
    if (!v) return;
    cb.current(v, true);
    setManual('');
  };

  return (
    <div id="scanner" className={`fixed inset-0 z-30 flex flex-col bg-black ${flash ? 'flash' : ''}`}>
      <video ref={video} playsInline muted autoPlay className="w-full flex-1 object-cover" />
      <div className="absolute left-[8%] right-[8%] top-[30%] h-[26%] rounded-[14px] border-[3px] border-ok shadow-[0_0_0_2000px_rgba(0,0,0,.35)]" />
      {contador !== undefined && (
        <div id="cnt" className="absolute right-4 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-ok text-[26px] font-extrabold text-white shadow-lg">
          {contador}
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-3.5 pt-[calc(14px+env(safe-area-inset-top))] text-white">
        <b>{titulo}</b>
        <button className="rounded-xl bg-white/20 px-3 py-2 font-bold" onClick={onCerrar}>{unaVez ? 'Cancelar' : 'Listo ✓'}</button>
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 text-white">
        {errorCam && <p className="mb-2 text-center text-sm text-amber-300">{errorCam}</p>}
        {!unaVez && <div id="last" className="text-center text-[28px] font-extrabold">{ultimo || '—'}</div>}
        <div className="mt-2.5 flex gap-2">
          <input
            id="manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && enviar()}
            placeholder="O escribe el código"
            inputMode="numeric"
            className="w-full rounded-xl bg-white/15 px-3.5 py-3 text-white placeholder:text-white/60 outline-none"
          />
          <button className="rounded-xl bg-ok px-4 font-bold" onClick={enviar}>OK</button>
        </div>
      </div>
    </div>
  );
}
