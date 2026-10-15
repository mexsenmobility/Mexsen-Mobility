'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Alerta, Btn, Card, Empty, Label, Modal, Sec, Tabla, inputCls, useToast } from '@/components/ui';
import { fdate, money, num, today } from '@/lib/format';

type Van = {
  ID: string; Alias: string; Marca: string; Modelo: string; Anio: number | ''; Placas: string; Km_actual: number; Proximo_servicio_km: number | '';
  Seguro_vence: string; Verificacion_vence: string; Tenencia_vence: string; GPS_link: string; Activa: string; Notas: string; Capacidad_tanque: number | '';
  km30: number; rend30: number | null; alertas: { nivel: string; texto: string }[]; ultimoChecklist: { fecha: string; fallas: string } | null;
};

export default function Flota() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [d, setD] = useState<{ vans: Van[]; gps: string } | null>(null);
  const [edit, setEdit] = useState<Partial<Van> | null>(null);
  const [mant, setMant] = useState<string | null>(null);
  const [hist, setHist] = useState<Van | null>(null);
  const cargar = useCallback(() => call('admin.vans').then(setD).catch((e) => toast(e.message, 'err')), [call, toast]);
  useEffect(() => { if (user) cargar(); }, [user, cargar]);
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Flota">
      <div className="mb-3 flex gap-2.5">
        <Btn sm className="flex-1" onClick={() => setEdit({})}>+ Nueva van</Btn>
        {d?.gps ? (
          <a className="flex flex-1 items-center justify-center rounded-xl border-[1.5px] border-line bg-white text-sm font-bold text-navy" href={d.gps} target="_blank" rel="noopener">📡 Ver GPS</a>
        ) : (
          <Link href="/admin/config/" className="flex flex-1 items-center justify-center rounded-xl border-[1.5px] border-line bg-white text-sm font-bold text-navy">📡 Configurar GPS</Link>
        )}
      </div>
      {!d ? <Cargando /> : d.vans.length === 0 ? <Empty>Registra tu primera van.</Empty> : d.vans.map((v) => (
        <Card key={v.ID} className={v.Activa === 'Sí' ? '' : 'opacity-60'}>
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{v.Alias}</h2><span className="text-mut">{v.Placas}</span></div>
          <p className="text-sm text-mut">{[v.Marca, v.Modelo, v.Anio].filter(Boolean).join(' ')}</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <div><div className="text-lg font-extrabold">{num(v.Km_actual)}</div><div className="text-xs text-mut">km actual</div></div>
            <div><div className="text-lg font-extrabold">{num(v.km30)}</div><div className="text-xs text-mut">km últimos 30 días</div></div>
            <div><div className="text-lg font-extrabold">{v.rend30 ? num(v.rend30, 1) : '—'}</div><div className="text-xs text-mut">km/l</div></div>
          </div>
          <p className="mt-2 text-[13px] text-mut">
            Próximo servicio: {num(v.Proximo_servicio_km)} km ({v.Proximo_servicio_km !== '' ? num(Number(v.Proximo_servicio_km) - v.Km_actual) + ' km restantes' : 'sin definir'})
            {' · '}Seguro {v.Seguro_vence || '—'} · Verificación {v.Verificacion_vence || '—'} · Tenencia {v.Tenencia_vence || '—'}
          </p>
          <div className="mt-2">{v.alertas.map((a, i) => <Alerta key={i} nivel={a.nivel}>{a.nivel === 'rojo' ? '🔴' : '🟡'} {a.texto}</Alerta>)}</div>
          {v.ultimoChecklist && <p className="text-[13px] text-mut">Último checklist {fdate(v.ultimoChecklist.fecha)}: {v.ultimoChecklist.fallas ? '⚠️ ' + v.ultimoChecklist.fallas : '✅ OK'}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn sm variant="ghost" onClick={() => setHist(v)}>Historial</Btn>
            <Btn sm variant="ghost" onClick={() => setMant(v.ID)}>+ Mantenimiento</Btn>
            {v.GPS_link && <a className="flex items-center rounded-xl border-[1.5px] border-line px-3.5 text-sm font-bold text-navy" href={v.GPS_link} target="_blank" rel="noopener">GPS</a>}
            <Btn sm variant="ghost" onClick={() => setEdit(v)}>Editar</Btn>
          </div>
        </Card>
      ))}
      {edit && <EditarVan v={edit} call={call} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); cargar(); }} />}
      {mant && <Mantenimiento vanId={mant} call={call} onClose={() => setMant(null)} onSaved={() => { setMant(null); cargar(); }} />}
      {hist && <Historial v={hist} call={call} onClose={() => setHist(null)} onChange={cargar} />}
    </Shell>
  );
}

function EditarVan({ v, call, onClose, onSaved }: { v: Partial<Van>; call: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Van>>(v);
  const c = (id: string, k: keyof Van, label: string, type = 'text') => (
    <div className="flex-1"><Label>{label}</Label><input id={id} className={inputCls} type={type} value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  async function guardar() {
    try { await call('admin.guardarVan', f); toast('Van guardada', 'ok'); onSaved(); } catch (e: any) { toast(e.message, 'err'); }
  }
  return (
    <Modal open onClose={onClose}>
      <h2 className="text-lg font-bold">{v.ID ? 'Editar van' : 'Nueva van'}</h2>
      {c('va', 'Alias', 'Nombre corto (ej. Van 1)')}
      <div className="flex gap-2.5">{c('vm', 'Marca', 'Marca')}{c('vmo', 'Modelo', 'Modelo')}{c('vy', 'Anio', 'Año', 'number')}</div>
      <div className="flex gap-2.5">{c('vp', 'Placas', 'Placas')}{c('vk', 'Km_actual', 'Km actual', 'number')}</div>
      <div className="flex gap-2.5">{c('vs', 'Proximo_servicio_km', 'Próximo servicio (km)', 'number')}{c('vct', 'Capacidad_tanque', 'Tanque (litros)', 'number')}</div>
      <div className="flex gap-2.5">{c('vse', 'Seguro_vence', 'Seguro vence', 'date')}{c('vve', 'Verificacion_vence', 'Verificación', 'date')}</div>
      {c('vte', 'Tenencia_vence', 'Tenencia / placas vence', 'date')}
      {c('vg', 'GPS_link', 'Link GPS de esta van (opcional)')}
      {c('vn', 'Notas', 'Notas')}
      {v.ID && (
        <>
          <Label>Activa</Label>
          <select id="vac" className={inputCls} value={f.Activa} onChange={(e) => setF({ ...f, Activa: e.target.value })}><option>Sí</option><option>No</option></select>
        </>
      )}
      <Btn className="mt-4" onClick={guardar}>Guardar</Btn>
    </Modal>
  );
}

function Mantenimiento({ vanId, call, onClose, onSaved }: { vanId: string; call: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ Tipo: '', Fecha: today(), Km: '', Costo: '', Proximo_km: '', Taller: '', Notas: '' });
  const c = (id: string, k: keyof typeof f, label: string, type = 'text', ph = '') => (
    <div className="flex-1"><Label>{label}</Label><input id={id} className={inputCls} type={type} placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} list={k === 'Tipo' ? 'mtl' : undefined} /></div>
  );
  async function guardar() {
    try { await call('admin.mantenimiento', { Van_ID: vanId, ...f }); toast('Mantenimiento registrado', 'ok'); onSaved(); } catch (e: any) { toast(e.message, 'err'); }
  }
  return (
    <Modal open onClose={onClose}>
      <h2 className="text-lg font-bold">Registrar mantenimiento</h2>
      <p className="text-sm text-mut">El costo se registra también como gasto.</p>
      {c('mt', 'Tipo', 'Tipo', 'text', 'Servicio de aceite, llantas, frenos…')}
      <datalist id="mtl">{['Servicio de aceite', 'Afinación', 'Llantas', 'Frenos', 'Reparación', 'Batería'].map((x) => <option key={x}>{x}</option>)}</datalist>
      <div className="flex gap-2.5">{c('mf', 'Fecha', 'Fecha', 'date')}{c('mk', 'Km', 'Km', 'number')}</div>
      <div className="flex gap-2.5">{c('mc', 'Costo', 'Costo $', 'number')}{c('mp', 'Proximo_km', 'Próximo (km)', 'number', 'automático')}</div>
      {c('mta', 'Taller', 'Taller')}{c('mn', 'Notas', 'Notas')}
      <Btn className="mt-4" onClick={guardar}>Guardar</Btn>
    </Modal>
  );
}

function Historial({ v, call, onClose, onChange }: { v: Van; call: any; onClose: () => void; onChange: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<any>(null);
  const cargar = useCallback(() => call('admin.vanHistorial', { id: v.ID }).then(setD).catch((e: Error) => toast(e.message, 'err')), [call, v.ID, toast]);
  useEffect(() => { cargar(); }, [cargar]);
  async function borrar(id: string) {
    if (!confirm('¿Eliminar este mantenimiento y su gasto?')) return;
    try { await call('admin.eliminar', { hoja: 'Mantenimientos', id }); toast('Eliminado', 'ok'); cargar(); onChange(); } catch (e: any) { toast(e.message, 'err'); }
  }
  return (
    <Modal open onClose={onClose}>
      <h2 className="text-lg font-bold">{v.Alias} · historial</h2>
      {!d ? <Cargando /> : (
        <>
          <Sec>Mantenimientos</Sec>
          <Tabla rows={d.mantenimientos} cols={[['Fecha', 'Fecha', fdate], ['Tipo', 'Tipo'], ['Km', 'Km', num], ['Costo', 'Costo', money], ['Taller', 'Taller'],
            ['', 'ID', (id: string) => <button className="text-bad" onClick={() => borrar(id)}>✕</button>]]} />
          <Sec>Combustible</Sec>
          <Tabla rows={d.combustible} cols={[['Fecha', 'Fecha', fdate], ['Litros', 'Litros'], ['$', 'Monto', money], ['Km', 'Km', num], ['Quién', 'Registro'],
            ['Ticket', 'Foto', (u: string) => (u ? <a href={u} target="_blank" rel="noopener" className="text-blue-600">ver</a> : '')]]} />
          <Sec>Viajes (rutas cerradas)</Sec>
          <Tabla rows={d.rutas} cols={[['Fecha', 'Fecha', fdate], ['Zona', 'Zona'], ['Chofer', 'Chofer'], ['Km', 'Km'], ['Entregados', 'Entregados']]} />
        </>
      )}
    </Modal>
  );
}
