'use client';
import { useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Empty, Item, Pill } from '@/components/ui';
import { Chat } from '@/components/chat';
import { Atras } from '@/components/atras';
import { fdate } from '@/lib/format';

type Conv = { ID: string; Nombre: string; ultimo: { Texto: string; Timestamp: string } | null; noLeidos: number };

export default function Mensajes() {
  const { user, call } = useSesion('admin');
  const [lista, setLista] = useState<Conv[] | null>(null);
  const [con, setCon] = useState<Conv | null>(null);
  useEffect(() => { if (user && !con) call<Conv[]>('admin.conversaciones').then(setLista).catch(() => setLista([])); }, [user, call, con]);
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Más">
      {con ? (
        <>
          <div className="mb-3 flex items-center gap-2.5">
            <button className="rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2 text-sm font-bold text-navy" onClick={() => setCon(null)}>‹</button>
            <h2 className="text-lg font-bold">{con.Nombre}</h2>
          </div>
          <Chat yo={user.id} vacio="Sin mensajes" cargar={() => call('admin.mensajes', { choferId: con.ID })} enviar={(t) => call('admin.enviar', { choferId: con.ID, texto: t })} />
        </>
      ) : (
        <>
          <Atras titulo="Mensajes" />
          {!lista ? <Cargando /> : lista.length === 0 ? <Empty>Aún no hay choferes.</Empty> : (
            <div className="flex flex-col gap-2">
              {lista.map((c) => (
                <Item key={c.ID} onClick={() => setCon(c)}>
                  <div><div className="font-semibold">{c.Nombre} {c.noLeidos > 0 && <Pill tone="r">{c.noLeidos}</Pill>}</div>
                    <div className="text-[13px] text-mut">{c.ultimo ? c.ultimo.Texto.slice(0, 60) : 'Sin mensajes'}</div></div>
                  <span className="text-sm text-mut">{c.ultimo ? fdate(c.ultimo.Timestamp) : ''}</span>
                </Item>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
