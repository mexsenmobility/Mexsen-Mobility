'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Shell, useSesion, Cargando } from '@/components/shell';
import { Btn, Card, Chips, Empty, Item, Label, Modal, Pill, Sec, Seg, inputCls, useToast } from '@/components/ui';
import { Scanner } from '@/components/scanner';
import { Anillo, colorScore } from '@/components/score';
import { fileToB64, ftime, geo, money, num } from '@/lib/format';

type Home = {
  user: { id: string; nombre: string };
  ruta: null | { ID: string; Zona: string; Link_ruta: string; Estado: string; Cargados: number; Entregados: number | ''; Km_inicio: number | ''; Hora_cierre: string };
  van: null | { Alias: string; Placas: string; Km_actual: number };
  ultimos: string[];
  checklist: boolean;
  noLeidos: number;
  motivos: string[];
};
type Panel = null | 'checklist' | 'incidencia' | 'gasolina' | 'cerrar';
const ITEMS = ['Llantas', 'Luces', 'Aceite', 'Golpes', 'Limpieza'] as const;

export default function ChoferHome() {
  const { user, call } = useSesion('chofer');
  const toast = useToast();
  const [h, setH] = useState<Home | null>(null);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [scan, setScan] = useState<null | 'carga' | 'incidencia'>(null);
  const [ultimo, setUltimo] = useState('');
  const ocupado = useRef(false);

  const cargar = useCallback(async () => {
    try { setH(await call<Home>('chofer.home')); setError(''); } catch (e: any) { setError(e.message); }
  }, [call]);
  useEffect(() => { if (user) cargar(); }, [user, cargar]);

  // Comparte la ubicación con el administrador mientras la ruta está abierta (máximo una vez por minuto).
  const rutaId = h?.ruta?.ID;
  const enCurso = h?.ruta && ['Cargando', 'En ruta'].includes(h.ruta.Estado);
  const [gps, setGps] = useState<'off' | 'on' | 'negado'>('off');
  useEffect(() => {
    if (!rutaId || !enCurso || !navigator.geolocation) return;
    let ultimo = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps('on');
        const ahora = Date.now();
        if (ahora - ultimo < 60000) return;
        ultimo = ahora;
        call('chofer.ubicacion', {
          rutaId, lat: p.coords.latitude, lng: p.coords.longitude,
          precision: p.coords.accuracy, velocidad: p.coords.speed !== null ? p.coords.speed * 3.6 : null,
        }).catch(() => {});
      },
      (e) => setGps(e.code === 1 ? 'negado' : 'off'),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [rutaId, enCurso, call]);

  async function escanear(texto: string) {
    if (!h?.ruta || ocupado.current) return;
    ocupado.current = true;
    try {
      const r = await call('chofer.scan', { rutaId: h.ruta.ID, texto });
      setH((x) => (x && x.ruta ? { ...x, ruta: { ...x.ruta, Cargados: r.cargados } } : x));
      if (r.duplicado) { setUltimo('Ya escaneado: ' + r.codigo); toast('Ese paquete ya estaba', 'err'); }
      else { setUltimo(r.codigo); if (r.otraRuta) toast('Ojo: este paquete también está en otra ruta de hoy', 'err'); }
    } catch (e: any) { toast(e.message, 'err'); }
    ocupado.current = false;
  }

  if (!user) return <Cargando />;
  const r = h?.ruta;
  const cerrada = r?.Estado === 'Cerrada';
  return (
    <Shell rol="chofer" title={'Hola, ' + user.nombre.split(' ')[0]} badge={{ Mensajes: h?.noLeidos || 0 }}>
      {error ? (
        <Empty>{error}<br /><br /><Btn sm variant="ghost" className="mx-auto" onClick={cargar}>Reintentar</Btn></Empty>
      ) : !h ? (
        <Cargando />
      ) : !r ? (
        <Card>
          <h2 className="text-lg font-bold">Sin ruta asignada hoy</h2>
          <p className="mt-1.5 text-sm text-mut">Cuando el administrador te asigne ruta aparecerá aquí.</p>
          <Btn variant="ghost" className="mt-3.5" onClick={cargar}>Actualizar</Btn>
        </Card>
      ) : (
        <>
          <div className="mb-3 rounded-[14px] bg-navy p-4 text-white">
            <div className="text-sm text-white/70">Ruta de hoy · {h.van ? `${h.van.Alias} · ${h.van.Placas}` : ''}</div>
            <h2 className="mt-1 text-[22px] font-bold">{r.Zona || 'Sin zona'}</h2>
            <div className="mt-3 flex gap-4">
              <div><div className="text-[34px] font-extrabold">{r.Cargados || 0}</div><div className="text-sm text-white/70">cargados</div></div>
              {cerrada && <div><div className="text-[34px] font-extrabold">{r.Entregados || 0}</div><div className="text-sm text-white/70">entregados</div></div>}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Pill tone={cerrada ? 'g' : 'b'}>{r.Estado}</Pill>
              {enCurso && <span id="gps" className="text-xs text-white/80">{gps === 'on' ? '📡 Ubicación activa' : gps === 'negado' ? '⚠️ Activa la ubicación para tu ruta' : '📡 Buscando señal…'}</span>}
            </div>
          </div>
          {r.Link_ruta && (
            <a className="mb-3 flex min-h-[52px] items-center justify-center rounded-xl border-[1.5px] border-line bg-white font-bold text-navy" href={r.Link_ruta} target="_blank" rel="noopener">
              📍 Abrir ruta en el mapa
            </a>
          )}
          {!cerrada && (
            <Btn variant="green" className="min-h-[64px] text-lg" onClick={() => { if (!h.checklist) toast('Recuerda hacer el checklist antes de salir'); setScan('carga'); }}>
              Escanear paquetes
            </Btn>
          )}
          <Sec>Pasos del día</Sec>
          <div className="flex flex-col gap-2">
            {[
              { ok: h.checklist, t: 'Checklist de la van', s: h.checklist ? 'Listo' : 'Antes de salir', p: 'checklist' as Panel },
              { ok: r.Cargados > 0, t: 'Escanear carga', s: `${r.Cargados} paquetes escaneados`, p: null, scan: true },
              { ok: cerrada, t: 'Cerrar ruta', s: cerrada ? 'Cerrada ' + ftime(r.Hora_cierre) : 'Al terminar', p: 'cerrar' as Panel },
            ].map((x) => (
              <Item key={x.t} onClick={cerrada ? undefined : () => (x.scan ? setScan('carga') : setPanel(x.p))}>
                <div><div className="font-semibold">{x.ok ? '✅ ' : '⬜ '}{x.t}</div><div className="text-[13px] text-mut">{x.s}</div></div>
                {!cerrada && <span className="text-mut">›</span>}
              </Item>
            ))}
          </div>
          <Sec>Reportar</Sec>
          <div className="grid grid-cols-2 gap-2.5">
            <Btn variant="red" onClick={() => setPanel('incidencia')}>⚠️ Incidencia</Btn>
            <Btn variant="amber" onClick={() => setPanel('gasolina')}>⛽ Gasolina</Btn>
          </div>
          <MiCalificacion key={r.Estado} call={call} />
          {h.ultimos.length > 0 && (
            <>
              <Sec>Últimos escaneados</Sec>
              <Card flat className="font-mono text-sm leading-7">{h.ultimos.map((c) => <div key={c}>{c}</div>)}</Card>
            </>
          )}
        </>
      )}

      {scan === 'carga' && r && (
        <Scanner titulo="Escanea la etiqueta" contador={r.Cargados} ultimo={ultimo} onCodigo={(t) => escanear(t)} onCerrar={() => { setScan(null); cargar(); }} />
      )}

      {h && r && (
        <>
          <Checklist open={panel === 'checklist'} onClose={() => setPanel(null)} h={h} call={call} onDone={cargar} />
          <Incidencia open={panel === 'incidencia'} onClose={() => setPanel(null)} h={h} call={call} />
          <Gasolina open={panel === 'gasolina'} onClose={() => setPanel(null)} h={h} call={call} />
          <Cerrar open={panel === 'cerrar'} onClose={() => setPanel(null)} h={h} call={call} onDone={cargar} />
        </>
      )}
    </Shell>
  );
}

type PanelProps = { open: boolean; onClose: () => void; h: Home; call: (a: string, d?: any) => Promise<any>; onDone?: () => void };

function Checklist({ open, onClose, h, call, onDone }: PanelProps) {
  const toast = useToast();
  const [km, setKm] = useState('');
  const [v, setV] = useState<Record<string, string>>({});
  const [com, setCom] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function guardar() {
    if (ITEMS.some((k) => !v[k])) return toast('Marca OK o Falla en cada punto', 'err');
    setBusy(true);
    try {
      await call('chofer.checklist', { rutaId: h.ruta!.ID, km, comentario: com, ...v, foto: foto ? await fileToB64(foto) : undefined });
      toast('Checklist guardado. ¡Buena ruta!', 'ok');
      onClose(); onDone?.();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold">Checklist de salida</h2>
      <p className="text-sm text-mut">{h.van?.Alias} · último km {num(h.van?.Km_actual)}</p>
      <Label>Kilometraje del tablero</Label>
      <input id="ckm" className={inputCls} type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder={`Ej. ${num(h.van?.Km_actual)}`} />
      {ITEMS.map((k) => (
        <div key={k} className="flex items-center justify-between border-b border-line py-3">
          <b>{k}</b>
          <div data-k={k}><Seg value={v[k]} onChange={(x) => setV({ ...v, [k]: x })} /></div>
        </div>
      ))}
      <Label>Comentario (opcional)</Label>
      <input id="ccom" className={inputCls} value={com} onChange={(e) => setCom(e.target.value)} placeholder="Ej. rayón puerta derecha" />
      <Label>Foto de la van (opcional)</Label>
      <input id="cfoto" type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
      <Btn id="ckbtn" variant="green" className="mt-4" disabled={busy} onClick={guardar}>Guardar y salir a ruta</Btn>
    </Modal>
  );
}

function Incidencia({ open, onClose, h, call }: PanelProps) {
  const toast = useToast();
  const [motivo, setMotivo] = useState<string>();
  const [codigo, setCodigo] = useState('');
  const [com, setCom] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  async function enviar() {
    if (!motivo) return toast('Elige el motivo', 'err');
    setBusy(true);
    try {
      await call('chofer.incidencia', { rutaId: h.ruta!.ID, motivo, codigo, comentario: com, foto: foto ? await fileToB64(foto) : undefined, ...(await geo()) });
      toast('Reporte enviado', 'ok');
      setMotivo(undefined); setCodigo(''); setCom(''); setFoto(null);
      onClose();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold">Reportar incidencia</h2>
      <p className="text-sm text-mut">Te protege ante reclamos. Toma foto cuando puedas.</p>
      <Label>Motivo</Label>
      <Chips options={h.motivos.map((m) => ({ v: m, l: m }))} value={motivo} onChange={setMotivo} />
      <Label>Código del paquete (opcional)</Label>
      <div className="flex gap-2">
        <input id="icod" className={inputCls} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Escanea o escribe" inputMode="numeric" />
        <Btn sm variant="ghost" onClick={() => setScan(true)}>Escanear</Btn>
      </div>
      <Label>Comentario</Label>
      <textarea id="icom" className={inputCls + ' min-h-[80px]'} value={com} onChange={(e) => setCom(e.target.value)} placeholder="Qué pasó" />
      <Label>Foto (opcional)</Label>
      <input id="ifoto" type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
      <Btn id="ibtn" variant="red" className="mt-4" disabled={busy} onClick={enviar}>Enviar reporte</Btn>
      {scan && (
        <Scanner titulo="Apunta al código" unaVez onCerrar={() => setScan(false)} onCodigo={(t) => {
          let c = t; try { const o = JSON.parse(t); c = String(o.id || o.shipment_id || t); } catch { /* no es JSON */ }
          setCodigo(c); setScan(false);
        }} />
      )}
    </Modal>
  );
}

function Gasolina({ open, onClose, h, call }: PanelProps) {
  const toast = useToast();
  const [f, setF] = useState({ km: '', litros: '', monto: '' });
  const [foto, setFoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function enviar() {
    if (!foto) return toast('Toma foto del ticket', 'err');
    setBusy(true);
    try {
      await call('chofer.gasolina', { rutaId: h.ruta!.ID, ...f, foto: await fileToB64(foto, 1000) });
      toast('Carga registrada', 'ok');
      setF({ km: '', litros: '', monto: '' }); setFoto(null);
      onClose();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold">Carga de gasolina</h2>
      <p className="text-sm text-mut">Obligatorio: foto del ticket.</p>
      <Label>Kilometraje del tablero</Label>
      <input id="gkm" className={inputCls} type="number" inputMode="numeric" value={f.km} onChange={(e) => setF({ ...f, km: e.target.value })} />
      <div className="flex gap-2.5">
        <div className="flex-1"><Label>Litros</Label><input id="glit" className={inputCls} type="number" inputMode="decimal" step="0.01" value={f.litros} onChange={(e) => setF({ ...f, litros: e.target.value })} /></div>
        <div className="flex-1"><Label>Monto $</Label><input id="gmon" className={inputCls} type="number" inputMode="decimal" step="0.01" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></div>
      </div>
      <Label>Foto del ticket</Label>
      <input id="gfoto" type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
      <Btn id="gbtn" variant="amber" className="mt-4" disabled={busy} onClick={enviar}>Registrar carga</Btn>
    </Modal>
  );
}

function Cerrar({ open, onClose, h, call, onDone }: PanelProps) {
  const toast = useToast();
  const r = h.ruta!;
  const [f, setF] = useState({ entregados: '', noEntregados: '', kmFin: '', notas: '' });
  const [busy, setBusy] = useState(false);
  const dif = (r.Cargados || 0) - (+f.entregados || 0) - (+f.noEntregados || 0);
  async function cerrar() {
    setBusy(true);
    try {
      const x = await call('chofer.cerrar', { rutaId: r.ID, ...f });
      toast(`Ruta cerrada · ${x.entregados} entregados${x.km !== null ? ' · ' + x.km + ' km' : ''}`, 'ok');
      onClose(); onDone?.();
    } catch (e: any) { toast(e.message, 'err'); }
    setBusy(false);
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold">Cerrar ruta</h2>
      <p className="text-sm text-mut">Cargaste <b>{r.Cargados || 0}</b> paquetes. Copia los números de la app de Mercado Libre.</p>
      <div className="flex gap-2.5">
        <div className="flex-1"><Label>Entregados</Label><input id="cent" className={inputCls} type="number" inputMode="numeric" value={f.entregados} onChange={(e) => setF({ ...f, entregados: e.target.value })} /></div>
        <div className="flex-1"><Label>No entregados</Label><input id="cno" className={inputCls} type="number" inputMode="numeric" value={f.noEntregados} onChange={(e) => setF({ ...f, noEntregados: e.target.value })} /></div>
      </div>
      {(f.entregados || f.noEntregados) && (
        <p id="dif" className="mt-2 text-sm text-mut">
          {dif === 0 ? '✅ Cuadra con lo cargado' : dif > 0 ? `⚠️ Faltan ${dif} paquetes por reportar` : `⚠️ Reportas ${-dif} más de los que cargaste`}
        </p>
      )}
      <Label>Kilometraje final</Label>
      <input id="ckmf" className={inputCls} type="number" inputMode="numeric" value={f.kmFin} onChange={(e) => setF({ ...f, kmFin: e.target.value })} placeholder={r.Km_inicio ? 'Salida: ' + num(r.Km_inicio) : ''} />
      <Label>Notas (opcional)</Label>
      <input id="cnot" className={inputCls} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} />
      <Btn id="cbtn" className="mt-4" disabled={busy} onClick={cerrar}>Cerrar ruta</Btn>
    </Modal>
  );
}

function MiCalificacion({ call }: { call: (a: string, d?: any) => Promise<any> }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { call('chofer.desempeno', { dias: 7 }).then(setD).catch(() => setD(null)); }, [call]);
  if (!d || !d.rutas) return null;
  return (
    <>
      <Sec>Tu calificación · últimos 7 días</Sec>
      <Card>
        <div id="mi-score" className="flex items-center gap-3.5">
          <Anillo score={d.score} />
          <div>
            <div className="font-bold" style={{ color: colorScore(d.score) }}>{d.nivel}</div>
            <div className="text-[13px] text-mut">{d.rutas} rutas · {num(d.entregados)} paquetes entregados</div>
            {d.bono !== null && <div className="text-sm font-semibold">Bono estimado: {money(d.bono)}</div>}
          </div>
        </div>
        {d.consejo && <p className="mt-3 rounded-lg bg-blue-50 p-2.5 text-[13px] text-blue-900"><b>Para subir:</b> {d.consejo}</p>}
        {d.bono !== null && d.score !== null && d.score < d.bonoFull && (
          <p className="mt-2 text-xs text-mut">Con {d.bonoFull}+ puntos cobras el bono completo{d.score < d.bonoMin ? ` y con ${d.bonoMin}+ la mitad` : ''}.</p>
        )}
      </Card>
    </>
  );
}
