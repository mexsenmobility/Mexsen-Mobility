'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Card, Empty, Item, Label, Modal, Pill, Sec, Stat, inputCls, useToast } from '@/components/ui';
import { addDays, fdate, ftime, num, today } from '@/lib/format';

type Ruta = {
  ID: string; Fecha: string; Zona: string; Chofer_ID: string; Chofer: string; Van_ID: string; Van: string; Link_ruta: string; Estado: string;
  Cargados: number; Entregados: number | ''; No_entregados: number | ''; Km_inicio: number | ''; Km_fin: number | ''; Hora_salida: string; Hora_cierre: string; Notas: string;
  incidencias?: number; checklist?: boolean;
};
type Cat = { choferes: { ID: string; Nombre: string; Rol: string }[]; vans: { ID: string; Alias: string; Placas: string }[] };
const TONO: Record<string, 'n' | 'b' | 'g' | 'r'> = { Asignada: 'n', Cargando: 'b', 'En ruta': 'b', Cerrada: 'g', Cancelada: 'r' };
const ESTADOS = ['Asignada', 'Cargando', 'En ruta', 'Cerrada', 'Cancelada'];

export default function Rutas() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [fecha, setFecha] = useState(today());
  const [d, setD] = useState<{ rutas: Ruta[]; catalogos: Cat } | null>(null);
  const [edit, setEdit] = useState<Partial<Ruta> | null>(null);
  const [ver, setVer] = useState<string | null>(null);
  const cargar = useCallback(() => call('admin.rutas', { fecha }).then(setD).catch((e) => toast(e.message, 'err')), [call, fecha, toast]);
  useEffect(() => { if (user) { setD(null); cargar(); } }, [user, cargar]);
  async function duplicar() {
    try { const r = await call('admin.duplicarRutas', { a: fecha, desde: addDays(fecha, -1) }); toast(`${r.creadas} rutas creadas`, 'ok'); cargar(); } catch (e: any) { toast(e.message, 'err'); }
  }
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Operación">
      <div className="mb-3 flex items-center gap-2">
        <Btn sm variant="ghost" onClick={() => setFecha(addDays(fecha, -1))}>‹</Btn>
        <input type="date" className={inputCls + ' text-center font-bold'} value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        <Btn sm variant="ghost" onClick={() => setFecha(addDays(fecha, 1))}>›</Btn>
      </div>
      <div className="mb-3 flex gap-2.5">
        <Btn sm className="flex-1" onClick={() => setEdit({ Fecha: fecha })}>+ Nueva ruta</Btn>
        <Btn sm variant="ghost" className="flex-1" onClick={duplicar}>Copiar las de ayer</Btn>
      </div>
      {!d ? <Cargando /> : d.rutas.length === 0 ? <Empty>No hay rutas este día.<br />Crea una o copia las de ayer.</Empty> : (
        <div className="flex flex-col gap-2">
          {d.rutas.map((r) => (
            <Item key={r.ID} onClick={() => setVer(r.ID)}>
              <div>
                <div className="font-semibold">{r.Zona || 'Sin zona'} · {r.Chofer}</div>
                <div className="text-[13px] text-mut">
                  {r.Van} · {r.Cargados || 0} cargados{r.Estado === 'Cerrada' ? ` · ${r.Entregados || 0} entregados` : ''}
                  {r.incidencias ? ` · ⚠️ ${r.incidencias}` : ''}{r.checklist ? '' : ' · sin checklist'}
                </div>
              </div>
              <Pill tone={TONO[r.Estado] || 'n'}>{r.Estado}</Pill>
            </Item>
          ))}
        </div>
      )}
      {edit && d && <EditarRuta r={edit} cat={d.catalogos} call={call} onClose={() => setEdit(null)} onSaved={(f) => { setEdit(null); if (f !== fecha) setFecha(f); else cargar(); }} />}
      {ver && <DetalleRuta id={ver} call={call} onClose={() => setVer(null)} onEdit={(r) => { setVer(null); setEdit(r); }} />}
    </Shell>
  );
}

function EditarRuta({ r, cat, call, onClose, onSaved }: { r: Partial<Ruta>; cat: Cat; call: any; onClose: () => void; onSaved: (fecha: string) => void }) {
  const toast = useToast();
  const choferes = cat.choferes.filter((u) => u.Rol === 'chofer');
  const [f, setF] = useState<Partial<Ruta>>({ Chofer_ID: choferes[0]?.ID, Van_ID: cat.vans[0]?.ID, ...r });
  const set = (k: keyof Ruta, v: string) => setF({ ...f, [k]: v });
  async function guardar() {
    try { await call('admin.guardarRuta', f); toast('Ruta guardada', 'ok'); onSaved(f.Fecha!); } catch (e: any) { toast(e.message, 'err'); }
  }
  const campo = (id: string, k: keyof Ruta, label: string, type = 'text') => (
    <div className="flex-1"><Label>{label}</Label><input id={id} className={inputCls} type={type} value={(f[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} /></div>
  );
  return (
    <Modal open onClose={onClose}>
      <h2 className="text-lg font-bold">{r.ID ? 'Editar ruta' : 'Nueva ruta'}</h2>
      {!choferes.length && <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-800">Primero da de alta a un chofer en Más → Choferes y usuarios.</p>}
      {!cat.vans.length && <p className="mt-2 rounded-lg bg-amber-100 p-2 text-sm text-amber-800">Primero registra una van en Flota.</p>}
      {campo('rf', 'Fecha', 'Fecha', 'date')}
      <Label>Zona / nombre de la ruta</Label>
      <input id="rz" className={inputCls} value={f.Zona ?? ''} onChange={(e) => set('Zona', e.target.value)} placeholder="Ej. Centro, Oriente, Lerdo" />
      <Label>Chofer</Label>
      <select id="rc" className={inputCls} value={f.Chofer_ID} onChange={(e) => set('Chofer_ID', e.target.value)}>
        {choferes.map((u) => <option key={u.ID} value={u.ID}>{u.Nombre}</option>)}
      </select>
      <Label>Van</Label>
      <select id="rv" className={inputCls} value={f.Van_ID} onChange={(e) => set('Van_ID', e.target.value)}>
        {cat.vans.map((v) => <option key={v.ID} value={v.ID}>{v.Alias} · {v.Placas}</option>)}
      </select>
      <Label>Link de la ruta (Google Maps u otro, opcional)</Label>
      <input id="rl" className={inputCls} inputMode="url" value={f.Link_ruta ?? ''} onChange={(e) => set('Link_ruta', e.target.value)} />
      {r.ID && (
        <>
          <Label>Estado</Label>
          <select id="re" className={inputCls} value={f.Estado} onChange={(e) => set('Estado', e.target.value)}>{ESTADOS.map((x) => <option key={x}>{x}</option>)}</select>
          <div className="flex gap-2.5">{campo('ren', 'Entregados', 'Entregados', 'number')}{campo('rno', 'No_entregados', 'No entregados', 'number')}</div>
          <div className="flex gap-2.5">{campo('rki', 'Km_inicio', 'Km inicio', 'number')}{campo('rkf', 'Km_fin', 'Km fin', 'number')}</div>
        </>
      )}
      <Label>Notas</Label>
      <input id="rn" className={inputCls} value={f.Notas ?? ''} onChange={(e) => set('Notas', e.target.value)} />
      <Btn className="mt-4" onClick={guardar}>Guardar</Btn>
    </Modal>
  );
}

function DetalleRuta({ id, call, onClose, onEdit }: { id: string; call: any; onClose: () => void; onEdit: (r: Ruta) => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { call('admin.ruta', { id }).then(setD).catch((e: Error) => setErr(e.message)); }, [id, call]);
  return (
    <Modal open onClose={onClose}>
      {err ? <Empty>{err}</Empty> : !d ? <Cargando /> : (
        <>
          <h2 className="text-lg font-bold">{d.ruta.Zona || 'Sin zona'} · {fdate(d.ruta.Fecha)}</h2>
          <p className="text-sm text-mut">{d.ruta.Chofer} · {d.ruta.Van} · {d.ruta.Estado}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat v={d.ruta.Cargados || 0} l="cargados" />
            <Stat v={d.ruta.Entregados === '' ? '—' : d.ruta.Entregados} l="entregados" />
            <Stat v={d.ruta.Km_inicio !== '' && d.ruta.Km_fin !== '' ? num(d.ruta.Km_fin - d.ruta.Km_inicio) : '—'} l="km" />
          </div>
          <p className="mt-2 text-sm text-mut">Salida {ftime(d.ruta.Hora_salida) || '—'} · Cierre {ftime(d.ruta.Hora_cierre) || '—'}{d.ruta.Notas ? ' · ' + d.ruta.Notas : ''}</p>
          <Sec>{d.checklist ? 'Checklist' : 'Sin checklist'}</Sec>
          {d.checklist && (
            <Card flat>
              Km {num(d.checklist.Km)} · {d.checklist.Fallas ? '⚠️ ' + d.checklist.Fallas : '✅ Todo OK'}{d.checklist.Comentario ? ' · ' + d.checklist.Comentario : ''}
              {d.checklist.Foto && <> · <a href={d.checklist.Foto} target="_blank" rel="noopener" className="text-blue-600">foto</a></>}
            </Card>
          )}
          {d.incidencias.length > 0 && (
            <>
              <Sec>Incidencias ({d.incidencias.length})</Sec>
              <div className="flex flex-col gap-2">
                {d.incidencias.map((i: any) => (
                  <Item key={i.ID}>
                    <div><div className="font-semibold">{i.Motivo}</div>
                      <div className="text-[13px] text-mut">{i.Codigo} {i.Comentario} {i.Foto && <a href={i.Foto} target="_blank" rel="noopener" className="text-blue-600">· foto</a>}</div></div>
                    <span className="text-mut">{ftime(i.Timestamp)}</span>
                  </Item>
                ))}
              </div>
            </>
          )}
          <Sec>Paquetes escaneados ({d.paquetes.length})</Sec>
          <Card flat className="max-h-52 overflow-auto font-mono text-[13px]">
            {d.paquetes.length ? d.paquetes.map((p: any) => <div key={p.Codigo}>{p.Hora}  {p.Codigo}</div>) : '—'}
          </Card>
          <Btn variant="ghost" onClick={() => onEdit(d.ruta)}>Editar ruta</Btn>
        </>
      )}
    </Modal>
  );
}
