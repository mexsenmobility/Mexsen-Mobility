'use client';

export const colorScore = (s: number | null) => (s === null ? '#9CA3AF' : s >= 90 ? '#22C55E' : s >= 80 ? '#84CC16' : s >= 65 ? '#F59E0B' : '#EF4444');

/** Anillo con la calificación 0-100. */
export function Anillo({ score, size = 72 }: { score: number | null; size?: number }) {
  const r = 30, c = 2 * Math.PI * r, v = score ?? 0, color = colorScore(score);
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label={`Calificación ${score ?? 'sin datos'}`} className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#E5E7EB" strokeWidth="7" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fontSize="18" fontWeight="800" fill="#111827">{score ?? '—'}</text>
    </svg>
  );
}

export type Parte = { id: string; nombre: string; valor: number | null; peso: number };

/** Barras con cada componente de la calificación. */
export function Partes({ partes }: { partes: Parte[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      {partes.map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-[13px]">
          <span className="w-40 shrink-0 text-mut">{p.nombre} <span className="text-[11px]">({p.peso}%)</span></span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
            {p.valor !== null && <i className="block h-full rounded-full" style={{ width: `${Math.max(3, p.valor)}%`, background: colorScore(p.valor) }} />}
          </div>
          <span className="w-8 text-right font-semibold">{p.valor ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
