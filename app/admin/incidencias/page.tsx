'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Chips, Empty, Item, Pill, useToast } from '@/components/ui';
import { Atras } from '@/components/atras';
import { fdate, ftime } from '@/lib/format';

type Inc = { ID: string; Timestamp: string; Fecha: string; Chofer: string; Codigo: string; Motivo: string; Comentario: string; Foto: string; Lat: number | ''; Lng: number | ''; Resuelta: string };

export default function Incidencias() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [todas, setTodas] = useState<'no' | 'si'>('no');
  const [d, setD] = useState<Inc[] | null>(null);
  const cargar = useCallback(() => call<Inc[]>('admin.incidencias', { todas: todas === 'si' }).then(setD).catch((e) => toast(e.message, 'err')), [call, todas, toast]);
  useEffect(() => { if (user) cargar(); }, [user, cargar]);
  async function resolver(id: string) { try { await call('admin.resolver', { id }); cargar(); } catch (e: any) { toast(e.message, 'err'); } }
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Más">
      <Atras titulo="Incidencias" />
      <div className="mb-3"><Chips options={[{ v: 'no', l: 'Abiertas' }, { v: 'si', l: 'Todas' }]} value={todas} onChange={setTodas} /></div>
      {!d ? <Cargando /> : d.length === 0 ? <Empty>Sin incidencias</Empty> : (
        <div className="flex flex-col gap-2">
          {d.map((i) => (
            <Item key={i.ID}>
              <div>
                <div className="font-semibold">{i.Motivo} {i.Resuelta === 'Sí' && <Pill tone="g">resuelta</Pill>}</div>
                <div className="text-[13px] text-mut">
                  {fdate(i.Fecha)} {ftime(i.Timestamp)} · {i.Chofer}{i.Codigo ? ' · ' + i.Codigo : ''}<br />
                  {i.Comentario}
                  {i.Foto && <> · <a href={i.Foto} target="_blank" rel="noopener" className="text-blue-600">foto</a></>}
                  {i.Lat !== '' && <> · <a href={`https://maps.google.com/?q=${i.Lat},${i.Lng}`} target="_blank" rel="noopener" className="text-blue-600">mapa</a></>}
                </div>
              </div>
              {i.Resuelta !== 'Sí' && <Btn sm variant="ghost" onClick={() => resolver(i.ID)} aria-label="Marcar como resuelta">✓</Btn>}
            </Item>
          ))}
        </div>
      )}
    </Shell>
  );
}
