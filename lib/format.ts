export const money = (n: unknown, d = 0) => {
  const v = Number(n);
  if (n === null || n === undefined || n === '' || !isFinite(v)) return '—';
  return (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
export const pct = (n: unknown) => {
  const v = Number(n);
  return n === null || n === undefined || !isFinite(v) ? '—' : Math.round(v * 1000) / 10 + '%';
};
export const num = (n: unknown, d = 0) => {
  const v = Number(n);
  return n === null || n === undefined || n === '' || !isFinite(v) ? '—' : v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fdate = (s?: string) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${MESES[+m[2] - 1]} ${+m[3]}` : s || '';
};
export const ftime = (s?: string) => String(s || '').slice(11, 16);
export const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function fileToB64(file: File, max = 1280): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc);
      c.height = Math.round(img.height * sc);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = rej;
    img.src = url;
  });
}

export function geo(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res({});
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res({}),
      { timeout: 5000 }
    );
  });
}

export function vibrar(p: number | number[]) {
  try { navigator.vibrate?.(p); } catch { /* sin vibración */ }
}
