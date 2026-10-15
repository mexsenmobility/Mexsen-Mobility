'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Alerta, Btn, Card, Empty, Sec, Stat } from '@/components/ui';
import { KpiCard, colorSalud, type Kpi } from '@/components/kpi';
import { num } from '@/lib/format';

type Inicio = {
  rutas: number; enRuta: number; cerradas: number; cargados: number; entregados: number; incidAbiertas: number; noLeidos: number;
  alertas: { nivel: string; texto: string; donde: string }[];
  salud: { score: number | null; etiqueta: string; texto: string };
  brujulas: Kpi[]; tarifaConfigurada: boolean;
};
const DESTINO: Record<string, string> = { config: '/admin/config/', choferes: '/admin/usuarios/', flota: '/admin/flota/', rutas: '/admin/rutas/' };

export default function AdminInicio() {
  const { user, call } = useSesion('admin');
  const router = useRouter();
  const [d, setD] = useState<Inicio | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (user) call<Inicio>('admin.inicio').then(setD).catch((e) => setError(e.message)); }, [user, call]);
  if (!user) return <Cargando />;
  const s = d?.salud;
  return (
    <Shell rol="admin" title="Mexsen Mobility">
      {error ? <Empty>{error}</Empty> : !d ? <Cargando /> : (
        <>
          {d.noLeidos > 0 && <Alerta nivel="amarillo" onClick={() => router.push('/admin/mensajes/')}>💬 Tienes {d.noLeidos} mensaje(s) sin leer de los choferes ›</Alerta>}
          <div className="grid grid-cols-3 gap-2">
            <Stat v={d.rutas} l="rutas hoy" /><Stat v={d.enRuta} l="en ruta" /><Stat v={d.cerradas} l="cerradas" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat v={num(d.cargados)} l="cargados hoy" /><Stat v={num(d.entregados)} l="entregados" />
            <Stat v={d.incidAbiertas} l="incidencias abiertas" color={d.incidAbiertas ? '#EF4444' : undefined} />
          </div>
          <Sec>Salud de la empresa · mes en curso</Sec>
          <Card>
            <div className="flex items-center gap-3.5">
              <div className="text-[34px] font-extrabold" style={{ color: colorSalud(s!.score) }}>{s!.score ?? '—'}</div>
              <div><b>{s!.etiqueta}</b><div className="text-[13px] text-mut">{s!.texto}</div></div>
            </div>
            {s!.score !== null && (
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-line"><i className="block h-full" style={{ width: `${s!.score}%`, background: colorSalud(s!.score) }} /></div>
            )}
          </Card>
          <Sec>Brújulas del mes</Sec>
          {d.brujulas.map((k) => <KpiCard key={k.id} k={k} />)}
          <Sec>Alertas</Sec>
          {d.alertas.length ? d.alertas.map((a, i) => (
            <Alerta key={i} nivel={a.nivel} onClick={() => router.push(DESTINO[a.donde] || '/admin/')}>{a.nivel === 'rojo' ? '🔴' : '🟡'} {a.texto}</Alerta>
          )) : <Card flat><span className="text-sm text-mut">Sin alertas. Todo en orden.</span></Card>}
          <Btn variant="ghost" className="mt-2" onClick={() => router.push('/admin/kpis/')}>Ver todos los KPIs y el plan de crecimiento →</Btn>
        </>
      )}
    </Shell>
  );
}
