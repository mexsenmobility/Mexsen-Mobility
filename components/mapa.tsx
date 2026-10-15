'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type RutaMapa = {
  ruta_id: string; zona: string | null; estado: string; cargados: number; entregados: number | null;
  chofer: string; van: string; placas: string | null; gps_link: string | null;
  ultima: { lat: number; lng: number; ts: string; vel: number | null } | null;
  recorrido: [number, number][];
};

const TORREON: [number, number] = [25.5428, -103.4068];
export const COLOR_ESTADO: Record<string, string> = { Asignada: '#6B7280', Cargando: '#2563EB', 'En ruta': '#22C55E', Cerrada: '#1E2A44' };

/** Mapa con la última posición de cada van y su recorrido del día (OpenStreetMap, sin costo). */
export function Mapa({ rutas, foco }: { rutas: RutaMapa[]; foco?: string | null }) {
  const div = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const capa = useRef<any>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !div.current) return;
      if (!mapa.current) {
        mapa.current = L.map(div.current, { zoomControl: true, attributionControl: true }).setView(TORREON, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '&copy; OpenStreetMap',
        }).addTo(mapa.current);
      }
      capa.current?.remove();
      capa.current = L.layerGroup().addTo(mapa.current);
      const puntos: [number, number][] = [];
      rutas.forEach((r) => {
        const color = COLOR_ESTADO[r.estado] || '#6B7280';
        if (r.recorrido.length > 1) L.polyline(r.recorrido, { color, weight: 3, opacity: 0.6 }).addTo(capa.current);
        if (!r.ultima) return;
        const p: [number, number] = [r.ultima.lat, r.ultima.lng];
        puntos.push(p);
        const hace = Math.round((Date.now() - new Date(r.ultima.ts).getTime()) / 60000);
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:999px;padding:3px 8px;font:700 12px Inter,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35);white-space:nowrap">🚐 ${esc(r.van)}</div>`,
          iconAnchor: [30, 12],
        });
        L.marker(p, { icon })
          .bindPopup(`<b>${esc(r.van)} · ${esc(r.chofer)}</b><br>${esc(r.zona || 'Sin zona')} · ${esc(r.estado)}<br>${r.cargados} cargados${r.entregados !== null ? ' · ' + r.entregados + ' entregados' : ''}<br><small>Última señal hace ${hace} min${r.ultima.vel ? ' · ' + Math.round(r.ultima.vel) + ' km/h' : ''}</small>`)
          .addTo(capa.current);
      });
      const enfocar = foco ? rutas.find((r) => r.ruta_id === foco)?.ultima : null;
      if (enfocar) mapa.current.setView([enfocar.lat, enfocar.lng], 15);
      else if (puntos.length === 1) mapa.current.setView(puntos[0], 14);
      else if (puntos.length > 1) mapa.current.fitBounds(L.latLngBounds(puntos).pad(0.25));
    })();
    return () => { vivo = false; };
  }, [rutas, foco]);

  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);
  return <div ref={div} className="z-0 h-[52vh] w-full overflow-hidden rounded-[14px] border-[1.5px] border-line" />;
}

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
