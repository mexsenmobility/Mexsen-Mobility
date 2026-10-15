'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Card, Empty, Item, Pill, Sec, inputCls, useToast } from '@/components/ui';
import { Mapa, COLOR_ESTADO, type RutaMapa } from '@/components/mapa';
import { addDays, today } from '@/lib/format';

export default function CentroControl() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [fecha, setFecha] = useState(today());
  const [rutas, setRutas] = useState<RutaMapa[] | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [act, setAct] = useState('');
  const cargar = useCallback(async () => {
    try {
      setRutas(await call<RutaMapa[]>('admin.mapa', { fecha }));
      setAct(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
    } catch (e: any) { toast(e.message, 'err'); }
  }, [call, fecha, toast]);
  useEffect(() => {
    if (!user) return;
    cargar();
    if (fecha !== today()) return;
    const t = setInterval(cargar, 60000); // en vivo: refresca cada minuto
    return () => clearInterval(t);
  }, [user, cargar, fecha]);
  if (!user) return <Cargando />;
  const conSenal = rutas?.filter((r) => r.ultima).length ?? 0;
  return (
    <Shell rol="admin" title="Centro de control">
      <div className="mb-3 flex items-center gap-2">
        <Btn sm variant="ghost" onClick={() => setFecha(addDays(fecha, -1))}>‹</Btn>
        <input type="date" className={inputCls + ' text-center font-bold'} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        <Btn sm variant="ghost" onClick={() => setFecha(addDays(fecha, 1))}>›</Btn>
      </div>
      {!rutas ? <Cargando /> : (
        <>
          <Mapa rutas={rutas} foco={foco} />
          <p className="mt-2 text-xs text-mut">
            {conSenal} de {rutas.length} vans con señal{act ? ` · actualizado ${act}` : ''}{fecha === today() ? ' · se actualiza solo cada minuto' : ''}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-mut">
            {Object.entries(COLOR_ESTADO).map(([k, c]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{k}</span>)}
          </div>
          <Sec>Vans hoy</Sec>
          {rutas.length === 0 ? <Empty>No hay rutas en esta fecha.</Empty> : (
            <div className="flex flex-col gap-2">
              {rutas.map((r) => {
                const hace = r.ultima ? Math.round((Date.now() - new Date(r.ultima.ts).getTime()) / 60000) : null;
                return (
                  <Item key={r.ruta_id} onClick={() => setFoco(r.ruta_id)}>
                    <div>
                      <div className="font-semibold">{r.van} · {r.chofer}</div>
                      <div className="text-[13px] text-mut">
                        {r.zona || 'Sin zona'} · {r.cargados} cargados{r.entregados !== null ? ` · ${r.entregados} entregados` : ''}
                        {' · '}{hace === null ? 'sin señal' : hace < 2 ? 'señal ahora' : `señal hace ${hace} min`}
                        {r.gps_link && <> · <a href={r.gps_link} target="_blank" rel="noopener" className="text-blue-600" onClick={(e) => e.stopPropagation()}>GPS de la van</a></>}
                      </div>
                    </div>
                    <Pill tone={r.estado === 'En ruta' ? 'g' : r.estado === 'Cerrada' ? 'n' : 'b'}>{r.estado}</Pill>
                  </Item>
                );
              })}
            </div>
          )}
          <Card flat className="mt-4">
            <p className="text-[13px] text-mut">
              La ubicación sale del celular del chofer mientras tiene la app abierta en ruta. Cuando conectemos el GPS de las vans, aquí verás la posición continua aunque el celular esté apagado.
            </p>
          </Card>
        </>
      )}
    </Shell>
  );
}
