'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, resetMe } from '@/lib/api';
import { fdate, today } from '@/lib/format';
import { Spinner, useToast } from './ui';

export type Usuario = { id: string; nombre: string; rol: 'admin' | 'chofer' };

/** Revisa la sesión y el rol; si no corresponde, manda al login o a la pantalla correcta. */
export function useSesion(rol: 'admin' | 'chofer') {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<Usuario | null>(null);
  useEffect(() => {
    let vivo = true;
    api('sesion')
      .then((u: Usuario) => {
        if (!vivo) return;
        if (u.rol !== rol) router.replace(u.rol === 'admin' ? '/admin/' : '/chofer/');
        else setUser(u);
      })
      .catch(() => router.replace('/login/'));
    return () => { vivo = false; };
  }, [rol, router]);
  /** Llama a la API; si la sesión expiró o el usuario fue desactivado, regresa al login. */
  const call = useCallback(
    async <T = any,>(action: string, data?: Record<string, unknown>): Promise<T> => {
      try {
        return await api(action, data);
      } catch (e: any) {
        if (e?.code === 'SESSION') {
          toast(e.message, 'err');
          router.replace('/login/');
        }
        throw e;
      }
    },
    [router, toast]
  );
  return { user, call };
}

export async function salir(router: ReturnType<typeof useRouter>) {
  try { await api('logout'); } catch { /* ya no hay sesión */ }
  resetMe();
  router.replace('/login/');
}

const I: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  route: <><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M12 19h4.5a3.5 3.5 0 000-7h-9a3.5 3.5 0 010-7H12" /></>,
  van: <><path d="M1 7h12v9H1zM13 10h5l3 3v3h-8z" /><circle cx="5" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></>,
  chart: <path d="M3 20h18M6 16V9M11 16V4M16 16v-6" />,
  more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  chat: <path d="M21 12a8 8 0 01-11.6 7.2L4 21l1.8-4.6A8 8 0 1121 12z" />,
};
export const Icon = ({ name, className = 'h-[22px] w-[22px]' }: { name: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>{I[name]}</svg>
);

const TABS = {
  admin: [
    { href: '/admin/', icon: 'home', label: 'Inicio' },
    { href: '/admin/rutas/', icon: 'route', label: 'Rutas' },
    { href: '/admin/flota/', icon: 'van', label: 'Flota' },
    { href: '/admin/kpis/', icon: 'chart', label: 'KPIs' },
    { href: '/admin/mas/', icon: 'more', label: 'Más' },
  ],
  chofer: [
    { href: '/chofer/', icon: 'home', label: 'Mi ruta' },
    { href: '/chofer/mensajes/', icon: 'chat', label: 'Mensajes' },
  ],
};

export function Shell({ rol, title, sub, badge, children }: { rol: 'admin' | 'chofer'; title: string; sub?: string; badge?: Record<string, number>; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const tabs = TABS[rol];
  const activo = (href: string) => (href === '/admin/' || href === '/chofer/' ? path === href || path === href.slice(0, -1) : path.startsWith(href.slice(0, -1)));
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2.5 bg-navy px-4 pb-3.5 pt-[calc(14px+env(safe-area-inset-top))] text-white">
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight">{title}</h1>
          <div className="text-xs opacity-75">{sub ?? fdate(today())}</div>
        </div>
        <button className="rounded-xl bg-white/15 px-3 py-2 text-sm font-bold" onClick={() => salir(router)}>Salir</button>
      </header>
      <main className="mx-auto max-w-3xl p-4 pb-[calc(84px+env(safe-area-inset-bottom))]">{children}</main>
      <nav className="tabs fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-3xl border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:rounded-t-2xl md:border">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`relative flex flex-1 flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[11px] font-semibold ${activo(t.href) ? 'on text-navy' : 'text-mut'}`}>
            {badge?.[t.label] ? <span className="absolute ml-5 -mt-1 rounded-full bg-bad px-1.5 text-[10px] font-extrabold text-white">{badge[t.label]}</span> : null}
            <Icon name={t.icon} />
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export const Cargando = () => <Spinner />;
