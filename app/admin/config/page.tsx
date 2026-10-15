'use client';
import { useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Card, Label, inputCls, useToast } from '@/components/ui';
import { Atras } from '@/components/atras';

type Row = { Clave: string; Valor: string; Descripcion: string };
const ORDEN = ['Nombre_negocio', 'Tarifa_por_paquete', 'Costo_van_nueva', 'GPS_link', 'Bono_por_paquete', 'Bono_score_minimo', 'Bono_score_completo', 'Meta_tasa_entrega', 'Meta_margen', 'Meta_utilizacion', 'Intervalo_servicio_km', 'Dias_alerta_vencimiento'];

export default function Config() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [link, setLink] = useState('');
  useEffect(() => {
    setLink(window.location.origin);
    if (user) call<Row[]>('admin.config').then((r) => setRows([...r].sort((a, b) => ORDEN.indexOf(a.Clave) - ORDEN.indexOf(b.Clave)))).catch((e) => toast(e.message, 'err'));
  }, [user, call, toast]);
  async function guardar() {
    const d: Record<string, string> = {};
    rows!.forEach((r) => (d[r.Clave] = r.Valor));
    try { await call('admin.guardarConfig', d); toast('Guardado', 'ok'); } catch (e: any) { toast(e.message, 'err'); }
  }
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Más">
      <Atras titulo="Configuración" />
      {!rows ? <Cargando /> : (
        <Card>
          {rows.map((r, i) => (
            <div key={r.Clave}>
              <Label>{r.Clave.replace(/_/g, ' ')}</Label>
              <input data-k={r.Clave} className={inputCls} value={r.Valor} onChange={(e) => { const x = [...rows]; x[i] = { ...r, Valor: e.target.value }; setRows(x); }} />
              <p className="mt-1 text-xs text-mut">{r.Descripcion}</p>
            </div>
          ))}
          <Btn className="mt-4" onClick={guardar}>Guardar</Btn>
        </Card>
      )}
      <Card flat>
        <b>Link para los choferes</b>
        <p className="mt-1 text-sm text-mut">Mándales este link por WhatsApp. Entran con su usuario y PIN y la agregan a la pantalla de inicio.</p>
        <input readOnly className={inputCls + ' mt-2 text-xs'} value={link} onClick={(e) => { (e.target as HTMLInputElement).select(); navigator.clipboard?.writeText(link).then(() => toast('Link copiado', 'ok')); }} />
      </Card>
    </Shell>
  );
}
