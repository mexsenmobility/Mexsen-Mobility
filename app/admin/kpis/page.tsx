'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Alerta, Card, Chips, Empty, Sec, Tabla, inputCls } from '@/components/ui';
import { Barra, KpiCard, Spark, colorSalud, type Kpi } from '@/components/kpi';
import { addDays, fdate, money, num, pct, today } from '@/lib/format';

type Plan = { titulo: string; detalle: string };
type Datos = {
  resumen: { ingreso: number; costos: number; utilidad: number; margen: number | null; entregados: number; km: number; rutas: number; diasOperados: number };
  kpis: Kpi[]; salud: { score: number | null; etiqueta: string };
  plan: { m1: Plan[]; m3: Plan[]; m6: Plan[]; nota: string };
  zonas: any[]; choferes: any[]; vans: any[]; rutas: any[]; diario: any[];
  gastosCat: { categoria: string; monto: number; share: number }[]; motivos: { motivo: string; n: number }[];
  tarifaConfigurada: boolean;
};

export default function Kpis() {
  const { user, call } = useSesion('admin');
  const router = useRouter();
  const t = today(), m0 = t.slice(0, 8) + '01', pm1 = addDays(m0, -1), pm0 = pm1.slice(0, 8) + '01';
  const rangos = [
    { v: `${m0}|${t}`, l: 'Este mes' }, { v: `${pm0}|${pm1}`, l: 'Mes pasado' },
    { v: `${addDays(t, -29)}|${t}`, l: '30 días' }, { v: `${addDays(t, -89)}|${t}`, l: '90 días' },
  ];
  const [desde, setDesde] = useState(m0);
  const [hasta, setHasta] = useState(t);
  const [d, setD] = useState<Datos | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!user) return;
    setD(null); setErr('');
    call<Datos>('admin.kpis', { desde, hasta }).then(setD).catch((e) => setErr(e.message));
  }, [user, call, desde, hasta]);
  if (!user) return <Cargando />;
  const R = d?.resumen;
  return (
    <Shell rol="admin" title="Dirección">
      <div className="mb-2.5"><Chips options={rangos} value={`${desde}|${hasta}` as string} onChange={(v) => { const [a, b] = v.split('|'); setDesde(a); setHasta(b); }} /></div>
      <div className="mb-3.5 flex gap-2.5">
        <input type="date" className={inputCls} value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
        <input type="date" className={inputCls} value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} />
      </div>
      {err ? <Empty>{err}</Empty> : !d || !R ? <Cargando /> : (
        <>
          {!d.tarifaConfigurada && <Alerta nivel="amarillo" onClick={() => router.push('/admin/config/')}>⚠️ Captura la tarifa por paquete en Configuración para ver ingresos y utilidad ›</Alerta>}
          <Card>
            <div className="flex items-start justify-between">
              <div><div className="text-sm text-mut">Utilidad del periodo</div><div className="text-[34px] font-extrabold" style={{ color: R.utilidad < 0 ? '#EF4444' : '#22C55E' }}>{money(R.utilidad)}</div></div>
              <div className="text-right"><div className="text-sm text-mut">Salud</div><div className="text-[26px] font-extrabold" style={{ color: colorSalud(d.salud.score) }}>{d.salud.score ?? '—'}</div><div className="text-xs text-mut">{d.salud.etiqueta}</div></div>
            </div>
            <Spark serie={d.diario} campo="utilidad" color="#22C55E" />
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div><b>{money(R.ingreso)}</b><div className="text-mut">ingresos</div></div>
              <div><b>{money(R.costos)}</b><div className="text-mut">gastos</div></div>
              <div><b>{pct(R.margen)}</b><div className="text-mut">margen</div></div>
              <div><b>{num(R.entregados)}</b><div className="text-mut">entregados</div></div>
              <div><b>{num(R.km)}</b><div className="text-mut">km</div></div>
              <div><b>{R.rutas}</b><div className="text-mut">rutas · {R.diasOperados} días</div></div>
            </div>
          </Card>

          <Sec>Plan de crecimiento</Sec>
          {d.plan.nota && <p className="mb-2.5 text-sm text-mut">{d.plan.nota}</p>}
          {([['1 mes · controlar', 'm1'], ['3 meses · eficiencia', 'm3'], ['6 meses · crecer', 'm6']] as const).map(([lbl, k]) => (
            <Card key={k}>
              <h3 className="mb-2.5 font-bold">{lbl}</h3>
              {d.plan[k].length ? d.plan[k].map((p) => (
                <div key={p.titulo} className="plan mb-3 border-l-4 border-navy py-1 pl-3"><b className="mb-1 block">{p.titulo}</b><p className="text-sm text-gray-700">{p.detalle}</p></div>
              )) : <p className="text-sm text-mut">Nada urgente aquí. Sigue así.</p>}
            </Card>
          ))}

          {['Dinero', 'Operación', 'Flota'].map((s) => (
            <div key={s}><Sec>{s}</Sec>{d.kpis.filter((k) => k.seccion === s).map((k) => <KpiCard key={k.id} k={k} vsTexto />)}</div>
          ))}
          <p className="-mt-1 mb-2 text-xs text-mut">Toca cualquier indicador para ver qué mide.</p>

          <Sec>Por zona</Sec>
          <Tabla rows={d.zonas} cols={[['Zona', 'nombre'], ['Rutas', 'rutas'], ['Entregados', 'entregados'], ['Tasa', 'tasa', pct], ['Km/paq', 'kmPaq', (v) => num(v, 2)], ['$/km', 'utilKm', (v) => money(v, 2)], ['Util/ruta', 'utilPorRuta', money]]} />
          <Sec>Por chofer</Sec>
          <Tabla rows={d.choferes} cols={[['Chofer', 'nombre'], ['Rutas', 'rutas'], ['Entregados', 'entregados'], ['Tasa', 'tasa', pct], ['Paq/hora', 'paqHora', (v) => num(v, 1)], ['Incid.', 'incidencias'], ['Util/ruta', 'utilPorRuta', money]]} />
          <Sec>Por van</Sec>
          <Tabla rows={d.vans} cols={[['Van', 'nombre'], ['Rutas', 'rutas'], ['Km', 'km', num], ['km/l', 'rend', (v) => num(v, 1)], ['Combustible', 'comb', money], ['Mantto.', 'mant', money], ['Util/ruta', 'utilPorRuta', money]]} />
          <Sec>Gastos por categoría</Sec>
          <Card>{d.gastosCat.length ? d.gastosCat.map((g) => <Barra key={g.categoria} label={g.categoria} valor={g.share} max={1} texto={`${money(g.monto)} · ${pct(g.share)}`} />) : <p className="text-sm text-mut">Sin gastos en el periodo</p>}</Card>
          <Sec>Motivos de no entrega</Sec>
          <Card>{d.motivos.length ? d.motivos.map((m) => <Barra key={m.motivo} label={m.motivo} valor={m.n} max={d.motivos[0].n} texto={String(m.n)} color="#EF4444" />) : <p className="text-sm text-mut">Sin incidencias en el periodo</p>}</Card>
          <Sec>Últimas rutas</Sec>
          <Tabla rows={d.rutas} cols={[['Fecha', 'fecha', fdate], ['Zona', 'zona'], ['Chofer', 'chofer'], ['Entr.', 'entregados'], ['Km', 'km'], ['Paq/h', 'paqHora', (v) => num(v, 1)], ['Utilidad', 'utilidad', money]]} />
        </>
      )}
    </Shell>
  );
}
