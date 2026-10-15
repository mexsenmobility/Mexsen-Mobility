'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Btn, Label, inputCls, useToast } from '@/components/ui';
import { Logo } from '@/components/logo';

export default function Login() {
  const router = useRouter();
  const toast = useToast();
  const [usuario, setUsuario] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('login', { usuario, pin });
      router.replace(r.user.rol === 'admin' ? '/admin/' : '/chofer/');
    } catch (err: any) {
      toast(err.message, 'err');
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <Logo />
      <h1 className="text-center text-[22px] font-extrabold">Mexsen Mobility</h1>
      <p className="mt-1.5 text-center text-sm text-mut">Entra con tu usuario y PIN</p>
      <form onSubmit={entrar}>
        <Label>Usuario</Label>
        <input id="lu" className={inputCls} autoComplete="username" autoCapitalize="none" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        <Label>PIN</Label>
        <input id="lp" className={inputCls} type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" required value={pin} onChange={(e) => setPin(e.target.value)} />
        <Btn id="lbtn" className="mt-5" disabled={busy}>Entrar</Btn>
      </form>
    </div>
  );
}
