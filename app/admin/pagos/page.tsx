'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Empty, Item, Label, Modal, inputCls, useToast } from '@/components/ui';
import { Atras } from '@/components/atras';
import { fdate, money, num, today } from '@/lib/format';

type Pago = { ID: string; Fecha: string; Desde: string; Hasta: string; Paquetes: number | ''; Monto: number; Referencia: string };

export default function Pagos() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [d, setD] = useState<Pago[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState({ Fecha: today(), Monto: '', Desde: '', Hasta: '', Paquetes: '', Referencia: '' });
  const cargar = useCallback(() => call<Pago[]>('admin.pagos').then(setD).catch((e) => toast(e.message, 'err')), [call, toast]);
  useEffect(() => { if (user) cargar(); }, [user, cargar]);
  async function guardar() {
    try { await call('admin.guardarPago', f); toast('Pago registrado', 'ok'); setNuevo(false); setF({ ...f, Monto: '', Paquetes: '', Referencia: '' }); cargar(); } catch (e: any) { toast(e.message, 'err'); }
  }
  async function borrar(id: string) {
    if (!confirm('¿Eliminar este pago?')) return;
    try { await call('admin.eliminar', { hoja: 'Pagos_ML', id }); cargar(); } catch (e: any) { toast(e.message, 'err'); }
  }
  const c = (id: string, k: keyof typeof f, label: string, type = 'text') => (
    <div className="flex-1"><Label>{label}</Label><input id={id} type={type} className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Más">
      <Atras titulo="Pagos de Mercado Libre" />
      <p className="mb-2.5 text-sm text-mut">Registra cada depósito de ML. El KPI &quot;Pagos ML vs. calculado&quot; cruza lo pagado contra lo que el sistema calcula.</p>
      <Btn className="mb-3" onClick={() => setNuevo(true)}>+ Registrar pago</Btn>
      {!d ? <Cargando /> : d.length === 0 ? <Empty>Sin pagos registrados</Empty> : (
        <div className="flex flex-col gap-2">
          {d.map((p) => (
            <Item key={p.ID}>
              <div><div className="font-semibold">{money(p.Monto)}</div>
                <div className="text-[13px] text-mut">{fdate(p.Fecha)}{p.Desde ? ` · periodo ${fdate(p.Desde)} – ${fdate(p.Hasta)}` : ''}{p.Paquetes !== '' ? ` · ${num(p.Paquetes)} paq` : ''}{p.Referencia ? ' · ' + p.Referencia : ''}</div></div>
              <button className="text-bad" onClick={() => borrar(p.ID)} aria-label="Eliminar pago">✕</button>
            </Item>
          ))}
        </div>
      )}
      <Modal open={nuevo} onClose={() => setNuevo(false)}>
        <h2 className="text-lg font-bold">Registrar pago de ML</h2>
        <div className="flex gap-2.5">{c('pf', 'Fecha', 'Fecha del depósito', 'date')}{c('pm', 'Monto', 'Monto $', 'number')}</div>
        <div className="flex gap-2.5">{c('pd', 'Desde', 'Periodo desde', 'date')}{c('ph', 'Hasta', 'hasta', 'date')}</div>
        <div className="flex gap-2.5">{c('pp', 'Paquetes', 'Paquetes pagados', 'number')}{c('pr', 'Referencia', 'Referencia')}</div>
        <Btn className="mt-4" onClick={guardar}>Guardar</Btn>
      </Modal>
    </Shell>
  );
}
