'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Card, Empty, Item, Label, Modal, inputCls, useToast } from '@/components/ui';
import { Barra } from '@/components/kpi';
import { Atras } from '@/components/atras';
import { fdate, money, today } from '@/lib/format';

type Gasto = { ID: string; Fecha: string; Categoria: string; Concepto: string; Monto: number; Meses: number; Van_ID: string; Chofer_ID: string; Litros: number | ''; Km: number | ''; Foto: string };
type Datos = { gastos: Gasto[]; total: number; porCategoria: Record<string, number>; catalogos: { categorias: string[]; vans: { ID: string; Alias: string }[]; choferes: { ID: string; Nombre: string }[] } };

export default function Gastos() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [desde, setDesde] = useState(today().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(today());
  const [d, setD] = useState<Datos | null>(null);
  const [edit, setEdit] = useState<Partial<Gasto> | null>(null);
  const cargar = useCallback(() => call<Datos>('admin.gastos', { desde, hasta }).then(setD).catch((e) => toast(e.message, 'err')), [call, desde, hasta, toast]);
  useEffect(() => { if (user) cargar(); }, [user, cargar]);
  if (!user) return <Cargando />;
  const cats = d ? Object.keys(d.porCategoria).sort((a, b) => d.porCategoria[b] - d.porCategoria[a]) : [];
  return (
    <Shell rol="admin" title="Más">
      <Atras titulo="Gastos" />
      <div className="mb-2.5 flex gap-2.5">
        <input type="date" className={inputCls} value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
        <input type="date" className={inputCls} value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} />
      </div>
      <Btn className="mb-3" onClick={() => setEdit({ Fecha: today(), Meses: 1 })}>+ Registrar gasto</Btn>
      {!d ? <Cargando /> : (
        <>
          <Card>
            <div className="text-sm text-mut">Total del periodo</div>
            <div className="big text-[34px] font-extrabold">{money(d.total)}</div>
            {cats.map((k) => <Barra key={k} label={k} valor={d.porCategoria[k]} max={d.total} texto={money(d.porCategoria[k])} />)}
          </Card>
          <p className="mb-2.5 mt-1.5 text-sm text-mut">Tip: seguro anual o tenencia se capturan una vez con &quot;Meses que cubre&quot; = 12 y el sistema lo reparte mes a mes en los KPIs.</p>
          {d.gastos.length === 0 ? <Empty>Sin gastos en el periodo</Empty> : (
            <div className="flex flex-col gap-2">
              {d.gastos.map((g) => (
                <Item key={g.ID} onClick={() => setEdit(g)}>
                  <div><div className="font-semibold">{g.Concepto}</div>
                    <div className="text-[13px] text-mut">{fdate(g.Fecha)} · {g.Categoria}{g.Meses > 1 ? ` · ${g.Meses} meses` : ''}{g.Van_ID ? ' · ' + (d.catalogos.vans.find((v) => v.ID === g.Van_ID)?.Alias || '') : ''}{g.Foto ? ' · 📎' : ''}</div></div>
                  <b>{money(g.Monto)}</b>
                </Item>
              ))}
            </div>
          )}
        </>
      )}
      {edit && d && <EditarGasto g={edit} cat={d.catalogos} call={call} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); cargar(); }} />}
    </Shell>
  );
}

function EditarGasto({ g, cat, call, onClose, onSaved }: { g: Partial<Gasto>; cat: Datos['catalogos']; call: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Gasto>>({ Categoria: cat.categorias[0], ...g });
  const set = (k: keyof Gasto, v: string) => setF({ ...f, [k]: v });
  async function guardar() { try { await call('admin.guardarGasto', f); toast('Gasto guardado', 'ok'); onSaved(); } catch (e: any) { toast(e.message, 'err'); } }
  async function borrar() {
    if (!confirm('¿Eliminar este gasto?')) return;
    try { await call('admin.eliminar', { hoja: 'Gastos', id: g.ID }); toast('Eliminado', 'ok'); onSaved(); } catch (e: any) { toast(e.message, 'err'); }
  }
  return (
    <Modal open onClose={onClose}>
      <h2 className="text-lg font-bold">{g.ID ? 'Editar gasto' : 'Registrar gasto'}</h2>
      <div className="flex gap-2.5">
        <div className="flex-1"><Label>Fecha</Label><input id="gf" type="date" className={inputCls} value={f.Fecha ?? ''} onChange={(e) => set('Fecha', e.target.value)} /></div>
        <div className="flex-1"><Label>Monto $</Label><input id="gm" type="number" step="0.01" className={inputCls} value={f.Monto ?? ''} onChange={(e) => set('Monto', e.target.value)} /></div>
      </div>
      <Label>Categoría</Label>
      <select id="gc" className={inputCls} value={f.Categoria} onChange={(e) => set('Categoria', e.target.value)}>{cat.categorias.map((c) => <option key={c}>{c}</option>)}</select>
      <Label>Concepto</Label>
      <input id="gco" className={inputCls} value={f.Concepto ?? ''} onChange={(e) => set('Concepto', e.target.value)} placeholder="Ej. Sueldo semana 41, Seguro Van 2" />
      <div className="flex gap-2.5">
        <div className="flex-1"><Label>Meses que cubre</Label><input id="gme" type="number" min={1} className={inputCls} value={f.Meses ?? 1} onChange={(e) => set('Meses', e.target.value)} /></div>
        <div className="flex-1"><Label>Van (opcional)</Label>
          <select id="gv" className={inputCls} value={f.Van_ID ?? ''} onChange={(e) => set('Van_ID', e.target.value)}><option value="">—</option>{cat.vans.map((v) => <option key={v.ID} value={v.ID}>{v.Alias}</option>)}</select></div>
      </div>
      <Label>Chofer (opcional)</Label>
      <select id="gch" className={inputCls} value={f.Chofer_ID ?? ''} onChange={(e) => set('Chofer_ID', e.target.value)}><option value="">—</option>{cat.choferes.map((u) => <option key={u.ID} value={u.ID}>{u.Nombre}</option>)}</select>
      <div className="flex gap-2.5">
        <div className="flex-1"><Label>Litros (si es gasolina)</Label><input id="gl" type="number" step="0.01" className={inputCls} value={f.Litros ?? ''} onChange={(e) => set('Litros', e.target.value)} /></div>
        <div className="flex-1"><Label>Km</Label><input id="gk" type="number" className={inputCls} value={f.Km ?? ''} onChange={(e) => set('Km', e.target.value)} /></div>
      </div>
      {g.Foto && <p className="mt-2.5"><a href={g.Foto} target="_blank" rel="noopener" className="text-blue-600">Ver comprobante</a></p>}
      <Btn className="mt-4" onClick={guardar}>Guardar</Btn>
      {g.ID && <Btn variant="ghost" className="mt-2 !text-bad" onClick={borrar}>Eliminar</Btn>}
    </Modal>
  );
}
