'use client';
import { useEffect, useRef, useState } from 'react';
import { Btn, Empty, inputCls, useToast } from './ui';
import { fdate, ftime } from '@/lib/format';

export type Msg = { ID: number; Timestamp: string; De_ID: string; Texto: string };

/** Conversación simple. `cargar` trae los mensajes (y los marca como leídos); `enviar` manda uno. */
export function Chat({ yo, cargar, enviar, vacio }: { yo: string; cargar: () => Promise<Msg[]>; enviar: (t: string) => Promise<unknown>; vacio: string }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [txt, setTxt] = useState('');
  const fin = useRef<HTMLDivElement>(null);
  const recargar = () => cargar().then(setMsgs).catch((e) => toast(e.message, 'err'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar(); const t = setInterval(recargar, 20000); return () => clearInterval(t); }, []);
  useEffect(() => { fin.current?.scrollIntoView(); }, [msgs]);
  async function mandar() {
    const t = txt.trim();
    if (!t) return;
    try { await enviar(t); setTxt(''); await recargar(); } catch (e: any) { toast(e.message, 'err'); }
  }
  return (
    <>
      <div>
        {msgs === null ? null : msgs.length === 0 ? <Empty>{vacio}</Empty> : msgs.map((m) => (
          <div key={m.ID} className={`msg mb-1.5 max-w-[80%] rounded-[14px] px-3 py-2.5 text-[15px] ${m.De_ID === yo ? 'me ml-auto rounded-br bg-navy text-white' : 'them rounded-bl border-[1.5px] border-line bg-white'}`}>
            {m.Texto}
            <div className="mt-0.5 text-[11px] opacity-60">{fdate(m.Timestamp)} {ftime(m.Timestamp)}</div>
          </div>
        ))}
        <div ref={fin} />
      </div>
      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] flex gap-2 pt-2">
        <input id="mtxt" className={inputCls} value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && mandar()} placeholder="Escribe un mensaje" />
        <Btn sm onClick={mandar}>Enviar</Btn>
      </div>
    </>
  );
}
