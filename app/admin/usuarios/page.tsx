'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Item, Label, Modal, Pill, inputCls, useToast } from '@/components/ui';
import { Atras } from '@/components/atras';
import { money } from '@/lib/format';

type U = { ID: string; Nombre: string; Usuario: string; Rol: string; Telefono: string; Licencia_vence: string; Sueldo_semanal: number | ''; Activo: string };

export default function Usuarios() {
  const { user, call } = useSesion('admin');
  const toast = useToast();
  const [d, setD] = useState<U[] | null>(null);
  const [edit, setEdit] = useState<Partial<U> | null>(null);
  const cargar = useCallback(() => call<U[]>('admin.usuarios').then(setD).catch((e) => toast(e.message, 'err')), [call, toast]);
  useEffect(() => { if (user) cargar(); }, [user, cargar]);
  if (!user) return <Cargando />;
  return (
    <Shell rol="admin" title="Más">
      <Atras titulo="Choferes y usuarios" />
      <Btn className="mb-3" onClick={() => setEdit({ Rol: 'chofer' })}>+ Nuevo usuario</Btn>
      {!d ? <Cargando /> : (
        <div className="flex flex-col gap-2">
          {d.map((u) => (
            <Item key={u.ID} onClick={() => setEdit(u)}>
              <div>
                <div className="font-semibold">{u.Nombre} <Pill tone={u.Rol === 'admin' ? 'b' : 'n'}>{u.Rol}</Pill> {u.Activo !== 'Sí' && <Pill tone="r">inactivo</Pill>}</div>
                <div className="text-[13px] text-mut">@{u.Usuario}{u.Telefono ? ' · ' + u.Telefono : ''}{u.Licencia_vence ? ' · licencia ' + u.Licencia_vence : ''}{u.Sueldo_semanal !== '' ? ` · ${money(u.Sueldo_semanal)}/sem` : ''}</div>
              </div>
              <span className="text-mut">›</span>
            </Item>
          ))}
        </div>
      )}
      {edit && <EditarUsuario u={edit} call={call} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); cargar(); }} />}
    </Shell>
  );
}

function EditarUsuario({ u, call, onClose, onSaved }: { u: Partial<U>; call: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<U> & { PIN?: string }>(u);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  async function guardar() {
    try { await call('admin.guardarUsuario', { ...f, PIN: f.PIN || undefined }); toast('Usuario guardado', 'ok'); onSaved(); } catch (e: any) { toast(e.message, 'err'); }
  }
  return (
    <Modal open onClose={onClose}>
      <h2 className="text-lg font-bold">{u.ID ? 'Editar usuario' : 'Nuevo usuario'}</h2>
      <Label>Nombre</Label>
      <input id="un" className={inputCls} value={f.Nombre ?? ''} onChange={(e) => set('Nombre', e.target.value)} />
      {!u.ID && (<><Label>Usuario (para entrar)</Label><input id="uu" className={inputCls} autoCapitalize="none" placeholder="minúsculas, sin espacios" value={f.Usuario ?? ''} onChange={(e) => set('Usuario', e.target.value)} /></>)}
      <Label>{u.ID ? 'Nuevo PIN (deja vacío para no cambiar)' : 'PIN (6 números)'}</Label>
      <input id="up" className={inputCls} inputMode="numeric" maxLength={6} placeholder="6 números" value={f.PIN ?? ''} onChange={(e) => set('PIN', e.target.value)} />
      <Label>Rol</Label>
      <select id="ur" className={inputCls} value={f.Rol} onChange={(e) => set('Rol', e.target.value)}>
        <option value="chofer">Chofer (solo ve su ruta)</option><option value="admin">Administrador (ve todo)</option>
      </select>
      <div className="flex gap-2.5">
        <div className="flex-1"><Label>Teléfono</Label><input id="ut" className={inputCls} inputMode="tel" value={f.Telefono ?? ''} onChange={(e) => set('Telefono', e.target.value)} /></div>
        <div className="flex-1"><Label>Licencia vence</Label><input id="ul" type="date" className={inputCls} value={f.Licencia_vence ?? ''} onChange={(e) => set('Licencia_vence', e.target.value)} /></div>
      </div>
      <Label>Sueldo semanal (referencia)</Label>
      <input id="us" type="number" className={inputCls} value={f.Sueldo_semanal ?? ''} onChange={(e) => set('Sueldo_semanal', e.target.value)} />
      {u.ID && (
        <>
          <Label>Activo</Label>
          <select id="ua" className={inputCls} value={f.Activo} onChange={(e) => set('Activo', e.target.value)}><option>Sí</option><option>No</option></select>
          <p className="mt-1.5 text-sm text-mut">Al desactivar, el chofer pierde acceso de inmediato.</p>
        </>
      )}
      <Btn className="mt-4" onClick={guardar}>Guardar</Btn>
    </Modal>
  );
}
