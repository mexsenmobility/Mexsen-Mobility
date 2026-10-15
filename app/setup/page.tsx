'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Btn, Label, inputCls, useToast } from '@/components/ui';
import { Logo } from '@/components/logo';

/** Primer arranque: crea al administrador. Solo funciona mientras no exista ninguno. */
export default function Setup() {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ nombre: '', usuario: '', pin: '' });
  const [busy, setBusy] = useState(false);
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('bootstrap', f);
      await api('login', { usuario: f.usuario, pin: f.pin });
      router.replace('/admin/');
    } catch (err: any) {
      toast(err.message, 'err');
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <Logo />
      <h1 className="text-center text-[22px] font-extrabold">Bienvenido a Mexsen Mobility</h1>
      <p className="mt-1.5 text-center text-sm text-mut">Crea tu acceso de administrador. Solo se hace una vez.</p>
      <form onSubmit={crear}>
        <Label>Tu nombre</Label>
        <input id="bn" className={inputCls} required placeholder="Ej. Santiago" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <Label>Usuario para entrar</Label>
        <input id="bu" className={inputCls} required autoCapitalize="none" placeholder="minúsculas, sin espacios" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} />
        <Label>PIN de 6 números</Label>
        <input id="bp" className={inputCls} required type="password" inputMode="numeric" maxLength={6} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} />
        <Btn id="bbtn" className="mt-5" disabled={busy}>Crear administrador</Btn>
      </form>
    </div>
  );
}
