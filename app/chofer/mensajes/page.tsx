'use client';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Chat } from '@/components/chat';

export default function MensajesChofer() {
  const { user, call } = useSesion('chofer');
  if (!user) return <Cargando />;
  return (
    <Shell rol="chofer" title="Mensajes" sub="Con el administrador">
      <Chat yo={user.id} vacio="Escríbele al administrador" cargar={() => call('chofer.mensajes')} enviar={(t) => call('chofer.enviar', { texto: t })} />
    </Shell>
  );
}
