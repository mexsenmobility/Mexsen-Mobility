'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';

/** Punto de entrada: manda a cada quien a su pantalla. */
export default function Inicio() {
  const router = useRouter();
  useEffect(() => {
    api('sesion')
      .then((u: { rol: string }) => router.replace(u.rol === 'admin' ? '/admin/' : '/chofer/'))
      .catch(async () => {
        try {
          const st = await api('estado');
          router.replace(st.hayAdmin ? '/login/' : '/setup/');
        } catch {
          router.replace('/login/');
        }
      });
  }, [router]);
  return <Spinner />;
}
