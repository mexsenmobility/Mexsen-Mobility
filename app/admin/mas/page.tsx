'use client';
import Link from 'next/link';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { PANEL_URL } from '@/lib/api';

const MENU = [
  ['/admin/desempeno/', '🏆 Desempeño de choferes'],
  ['/admin/mensajes/', '💬 Mensajes con choferes'],
  ['/admin/gastos/', '💸 Gastos'],
  ['/admin/incidencias/', '⚠️ Incidencias'],
  ['/admin/pagos/', '🏦 Pagos de Mercado Libre'],
  ['/admin/usuarios/', '👤 Choferes y usuarios'],
  ['/admin/config/', '⚙️ Configuración'],
];

export default function Mas() {
  const { user } = useSesion('admin');
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Más">
      <div className="flex flex-col gap-2">
        {MENU.map(([href, l]) => (
          <Link key={href} href={href} className="item flex items-center justify-between rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 font-semibold">
            {l}<span className="text-mut">›</span>
          </Link>
        ))}
        <a href={PANEL_URL} target="_blank" rel="noopener" className="flex items-center justify-between rounded-xl border-[1.5px] border-line bg-white px-3.5 py-3 font-semibold">
          📊 Abrir la base de datos (Supabase)<span className="text-mut">↗</span>
        </a>
      </div>
      <p className="mt-5 text-center text-sm text-mut">Mexsen Mobility v2.0</p>
    </Shell>
  );
}
