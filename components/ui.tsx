'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { vibrar } from '@/lib/format';

/* ---------- Avisos (toast) ---------- */
type ToastKind = '' | 'ok' | 'err';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((msg: string, kind: ToastKind = '') => {
    setT({ msg, kind });
    vibrar(kind === 'err' ? [80, 50, 80] : 30);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), kind === 'err' ? 3500 : 2200);
  }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div
          id="toast"
          role="status"
          className={`fixed left-1/2 -translate-x-1/2 bottom-[calc(90px+env(safe-area-inset-bottom))] z-50 max-w-[92%] rounded-xl px-4 py-3 text-center font-semibold text-white shadow-xl ${
            t.kind === 'err' ? 'bg-bad' : t.kind === 'ok' ? 'bg-ok' : 'bg-gray-900'
          }`}
        >
          {t.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ---------- Botones e inputs ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'navy' | 'green' | 'red' | 'amber' | 'ghost'; sm?: boolean };
export function Btn({ variant = 'navy', sm, className = '', ...p }: BtnProps) {
  const v = {
    navy: 'bg-navy text-white',
    green: 'bg-ok text-white',
    red: 'bg-bad text-white',
    amber: 'bg-warn text-white',
    ghost: 'bg-white text-navy border-[1.5px] border-line',
  }[variant];
  return (
    <button
      {...p}
      className={`flex items-center justify-center gap-2 rounded-xl font-bold leading-tight disabled:opacity-50 ${
        sm ? 'min-h-[40px] px-3.5 py-2 text-sm' : 'min-h-[52px] w-full px-4 py-3.5'
      } ${v} ${className}`}
    />
  );
}
export const Label = ({ children }: { children: ReactNode }) => (
  <label className="mb-1.5 mt-3 block text-[13px] font-semibold text-mut">{children}</label>
);
export const inputCls =
  'w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 text-base text-gray-900 outline-none focus:border-navy';

/* ---------- Modal ---------- */
export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="modal fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box max-h-[92vh] w-full max-w-3xl overflow-auto rounded-t-[20px] bg-white px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5">
        {children}
      </div>
    </div>
  );
}

/* ---------- Piezas ---------- */
export const Card = ({ children, className = '', flat }: { children: ReactNode; className?: string; flat?: boolean }) => (
  <div className={`mb-3 rounded-[14px] bg-white p-4 ${flat ? 'border-[1.5px] border-line' : 'shadow-sm'} ${className}`}>{children}</div>
);
export const Sec = ({ children }: { children: ReactNode }) => (
  <div className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-[.08em] text-mut">{children}</div>
);
export const Stat = ({ v, l, color }: { v: ReactNode; l: string; color?: string }) => (
  <div className="stat rounded-xl border-[1.5px] border-line bg-white p-3">
    <div className="text-[22px] font-extrabold" style={color ? { color } : undefined}>{v}</div>
    <div className="mt-0.5 text-xs text-mut">{l}</div>
  </div>
);
export function Pill({ children, tone = 'n' }: { children: ReactNode; tone?: 'g' | 'r' | 'a' | 'n' | 'b' }) {
  const c = { g: 'bg-green-100 text-green-700', r: 'bg-red-100 text-red-700', a: 'bg-amber-100 text-amber-700', n: 'bg-gray-200 text-gray-700', b: 'bg-blue-100 text-blue-700' }[tone];
  return <span className={`pill inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${c}`}>{children}</span>;
}
export const Item = ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`item flex items-center justify-between gap-2.5 rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 ${onClick ? 'cursor-pointer' : ''}`}
  >
    {children}
  </div>
);
export const Spinner = () => <div className="mx-auto my-8 h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-navy" />;
export const Empty = ({ children }: { children: ReactNode }) => <div className="px-2.5 py-8 text-center text-mut">{children}</div>;
export function Alerta({ nivel, children, onClick }: { nivel: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`alert mb-2 flex cursor-pointer gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium ${nivel === 'rojo' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}
    >
      {children}
    </div>
  );
}

export function Seg({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="seg flex overflow-hidden rounded-xl border-[1.5px] border-line">
      {['OK', 'Falla'].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3.5 py-2 text-sm font-bold ${
            value === v ? (v === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : 'bg-white text-mut'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { v: T; l: string }[]; value?: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`chip rounded-full border-[1.5px] px-3.5 py-2 text-sm font-semibold ${
            value === o.v ? 'on border-navy bg-navy text-white' : 'border-line bg-white text-gray-900'
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Tabla<T extends Record<string, unknown>>({ rows, cols }: { rows: T[]; cols: [string, keyof T, ((v: any) => ReactNode)?][] }) {
  if (!rows || !rows.length) return <Card flat><span className="text-sm text-mut">Sin datos en el periodo</span></Card>;
  return (
    <div className="mb-3 overflow-x-auto rounded-[14px] bg-white px-2.5 py-1.5 shadow-sm">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>{cols.map((c) => <th key={c[0]} className="whitespace-nowrap border-b-[1.5px] border-line px-1.5 py-2 text-left font-semibold text-mut">{c[0]}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => {
                const v = r[c[1]];
                return <td key={c[0]} className="whitespace-nowrap border-b border-line px-1.5 py-2">{v === null || v === undefined ? '—' : c[2] ? c[2](v) : String(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
