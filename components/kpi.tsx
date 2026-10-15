'use client';
import { useState } from 'react';
import { money, num, pct } from '@/lib/format';

export type Kpi = {
  id: string; seccion: string; nombre: string; fmt: string; unidad?: string; valor: number | null; prev: number | null;
  cambio: number | null; mejorSi: 'up' | 'down'; meta?: number; estado: 'verde' | 'amarillo' | 'rojo' | 'gris';
  que: string; lectura: string; brujula?: boolean;
};

export function kpiValor(k: Kpi) {
  if (k.valor === null) return '—';
  const v = k.valor;
  return ({ money: money(v), money2: money(v, 2), pct: pct(v), num: num(v), num1: num(v, 1), num2: num(v, 2) } as Record<string, string>)[k.fmt] ?? String(v);
}

const BORDE = { verde: 'border-l-ok', amarillo: 'border-l-warn', rojo: 'border-l-bad', gris: 'border-l-gray-400' };

export function KpiCard({ k, vsTexto }: { k: Kpi; vsTexto?: boolean }) {
  const [open, setOpen] = useState(false);
  const bueno = k.cambio !== null && (k.cambio >= 0) === (k.mejorSi === 'up');
  return (
    <div onClick={() => setOpen(!open)} className={`kpi ${k.estado} ${open ? 'open' : ''} mb-2.5 cursor-pointer rounded-xl border-[1.5px] border-l-[5px] border-line bg-white p-3.5 ${BORDE[k.estado]}`}>
      <div className="flex items-center justify-between gap-2">
        <b>{k.nombre}{k.brujula ? ' 🧭' : ''}</b>
        {k.cambio !== null && (
          <span className={`text-xs font-bold ${bueno ? 'text-ok' : 'text-bad'}`}>
            {k.cambio >= 0 ? '▲' : '▼'} {pct(Math.abs(k.cambio))}{vsTexto ? ' vs. periodo anterior' : ''}
          </span>
        )}
      </div>
      <div className="v text-[26px] font-extrabold">
        {kpiValor(k)}
        {k.unidad && <small className="ml-1 text-[13px] font-semibold text-mut">{k.unidad}</small>}
        {k.meta !== undefined && k.valor !== null && <small className="ml-2 text-xs font-semibold text-mut">meta {k.fmt === 'pct' ? pct(k.meta) : k.meta}</small>}
      </div>
      <div className="mt-1.5 text-[13px] text-mut">{k.lectura}</div>
      <div className="q mt-1.5 text-xs text-mut">ℹ️ {k.que}</div>
    </div>
  );
}

export function Spark({ serie, campo, color }: { serie: Record<string, number>[]; campo: string; color: string }) {
  if (!serie?.length) return null;
  const w = 320, h = 70;
  const vals = serie.map((x) => x[campo] || 0);
  const mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
  const y = (v: number) => h - ((v - mn) / (mx - mn || 1)) * (h - 6) - 3;
  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * w},${y(v)}`).join(' ');
  return (
    <svg className="h-[70px] w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Tendencia diaria">
      <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="#E5E7EB" />
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}

export function Barra({ label, valor, max, texto, color = '#1E2A44' }: { label: string; valor: number; max: number; texto: string; color?: string }) {
  return (
    <div className="my-1.5 flex items-center gap-2 text-[13px]">
      <b className="min-w-[96px] font-semibold">{label}</b>
      <i className="block h-3 rounded-md" style={{ width: `${Math.max(2, (valor / (max || 1)) * 55)}%`, background: color }} />
      <span className="text-mut">{texto}</span>
    </div>
  );
}

export const colorSalud = (s: number | null) => (s === null ? '#6B7280' : s >= 80 ? '#22C55E' : s >= 60 ? '#F59E0B' : '#EF4444');
