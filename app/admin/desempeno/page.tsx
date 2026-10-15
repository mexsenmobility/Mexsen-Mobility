'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Alerta, Card, Chips, Empty } from '@/components/ui';
import { Atras } from '@/components/atras';
import { Anillo, Partes, colorScore, type Parte } from '@/components/score';
import { addDays, money, num, pct, today } from '@/lib/format';

type Chofer = {
  id: string; nombre: string; rutas: number; entregados: number; incidencias: number; score: number | null; nivel: string;
  partes: Parte[]; tasa: number | null; paqHora: number | null; kml: number | null; consejo: string | null; foco: string | null; bono: number | null; bonoFactor: number;
};
type Datos = { choferes: Chofer[]; flota: { paqHora: number | null; kml: number | null }; bonoConfigurado: boolean; bonoMin: number; bonoFull: number; bonoPaq: number };

export default function Desempeno() {
  const { user, call } = useSesion('admin');
  const router = useRouter();
  const t = today();
  const rangos = [
    { v: `${addDays(t, -6)}|${t}`, l: '7 días' },
    { v: `${addDays(t, -29)}|${t}`, l: '30 días' },
    { v: `${t.slice(0, 8)}01|${t}`, l: 'Este mes' },
  ];
  const [rango, setRango] = useState(rangos[0].v);
  const [d, setD] = useState<Datos | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!user) return;
    const [desde, hasta] = rango.split('|');
    setD(null);
    call<Datos>('admin.desempeno', { desde, hasta }).then(setD).catch((e) => setErr(e.message));
  }, [user, call, rango]);
  if (!user) return <Cargando />;
  const totalBono = d?.choferes.reduce((a, c) => a + (c.bono || 0), 0) || 0;
  return (
    <Shell rol="admin" title="Más">
      <Atras titulo="Desempeño de choferes" />
      <div className="mb-3"><Chips options={rangos} value={rango} onChange={setRango} /></div>
      {err ? <Empty>{err}</Empty> : !d ? <Cargando /> : d.choferes.length === 0 ? <Empty>Aún no hay rutas cerradas en este periodo.</Empty> : (
        <>
          {!d.bonoConfigurado ? (
            <Alerta nivel="amarillo" onClick={() => router.push('/admin/config/')}>💡 Define un bono por paquete en Configuración para que el sistema calcule cuánto le toca a cada chofer ›</Alerta>
          ) : (
            <Card flat>
              <div className="text-sm text-mut">Bono estimado del periodo</div>
              <div className="text-[28px] font-extrabold">{money(totalBono)}</div>
              <p className="text-xs text-mut">{money(d.bonoPaq, 2)} por paquete entregado · completo con {d.bonoFull}+ puntos · mitad con {d.bonoMin}+</p>
            </Card>
          )}
          <p className="mb-3 text-xs text-mut">Promedio de la flotilla: {num(d.flota.paqHora, 1)} paq/hora · {num(d.flota.kml, 1)} km/l</p>
          {d.choferes.map((c, i) => (
            <Card key={c.id}>
              <div className="flex items-center gap-3.5">
                <Anillo score={c.score} />
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold">{i === 0 && c.score !== null ? '🏆 ' : ''}{c.nombre}</div>
                  <div className="text-sm font-semibold" style={{ color: colorScore(c.score) }}>{c.nivel}</div>
                  <div className="text-[13px] text-mut">{c.rutas} rutas · {num(c.entregados)} entregados · {pct(c.tasa)} · {num(c.paqHora, 1)} paq/h</div>
                </div>
                {c.bono !== null && (
                  <div className="text-right"><div className="text-xs text-mut">Bono</div><div className="font-extrabold">{money(c.bono)}</div></div>
                )}
              </div>
              <Partes partes={c.partes} />
              {c.consejo && (
                <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[13px] text-amber-900"><b>Enfócate en {c.foco?.toLowerCase()}:</b> {c.consejo}</p>
              )}
            </Card>
          ))}
          <p className="text-xs text-mut">
            Cómo se calcula: tasa de entrega 30%, paquetes por hora contra la flotilla 25%, incidencias 15%, checklist 15%, cierres que cuadran 10% y rendimiento de combustible 5%. Si falta un dato, su peso se reparte entre los demás.
          </p>
        </>
      )}
    </Shell>
  );
}
