/* Capa de datos: traduce las acciones de la app a Supabase.
   Devuelve exactamente las mismas estructuras que usa la interfaz. */
// @ts-nocheck
import { sb } from './supabase';
import { FK } from './kpis';
import { SUPABASE_URL } from './config';
const DOMINIO = 'flotilla.app';
const CATEGORIAS = ['Combustible', 'Sueldos', 'IMSS/Prestaciones', 'Seguro', 'Tenencia/Placas', 'Mantenimiento', 'Llantas', 'Reparaciones', 'Casetas', 'Multas', 'Telefonía/Datos', 'Renta/Oficina', 'Otros'];

/* ---------- utilidades ---------- */
class SessionError extends Error { constructor(m) { super(m); this.code = 'SESSION'; } }
function fail(error) {
  if (!error) return;
  const m = error.message || String(error);
  if (/JWT|jwt expired|not authenticated|Usuario desactivado/i.test(m) || error.code === 'PGRST301' || error.status === 401) throw new SessionError(/desactivado/i.test(m) ? 'Usuario desactivado' : 'Tu sesión expiró. Vuelve a entrar.');
  if (/row-level security|permission denied/i.test(m)) throw new Error('No tienes permiso para esto');
  throw new Error(m.replace(/^.*?ERROR:\s*/, ''));
}
async function q(p) { const { data, error } = await p; fail(error); return data; }
async function all(build) { // paginación por si hay más de 1000 filas
  const out = []; let from = 0;
  for (;;) { const rows = await q(build().range(from, from + 999)); out.push(...rows); if (rows.length < 1000) break; from += 1000; }
  return out;
}
const fmtTs = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = t => (f.find(x => x.type === t) || {}).value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
};
const sino = b => b ? 'Sí' : 'No';
const nz = v => (v === '' || v === undefined || v === null) ? null : v;
const nnum = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const nint = v => { const n = parseInt(v, 10); return isFinite(n) ? n : null; };
const today = () => FK.today();
let ME = null;
async function me() {
  if (ME) return ME;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new SessionError('Inicia sesión');
  const p = await q(sb.from('perfiles').select('id, nombre, rol, activo').eq('id', session.user.id).maybeSingle());
  if (!p || !p.activo) { await sb.auth.signOut(); throw new SessionError('Usuario desactivado'); }
  ME = { id: p.id, nombre: p.nombre, rol: p.rol };
  return ME;
}

/* ---------- fotos ---------- */
async function subirFoto(dataUrl, tipo) {
  if (!dataUrl) return null;
  const u = await me();
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${u.id}/${tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  fail(error);
  return path;
}
async function firmar(rows, key) {
  const paths = [...new Set(rows.map(r => r[key]).filter(Boolean))];
  if (!paths.length) return rows;
  const { data, error } = await sb.storage.from('fotos').createSignedUrls(paths, 3600);
  if (error) return rows;
  const m = {}; (data || []).forEach(x => { if (x.signedUrl) m[x.path] = x.signedUrl; });
  rows.forEach(r => { if (r[key]) r[key] = m[r[key]] || ''; });
  return rows;
}

/* ---------- mapeos (columnas → nombres que usa la interfaz) ---------- */
const mRuta = r => ({
  ID: r.id, Fecha: r.fecha, Zona: r.zona || '', Chofer_ID: r.chofer_id, Chofer: r.chofer ? r.chofer.nombre : '', Van_ID: r.van_id, Van: r.van ? r.van.alias : '',
  Link_ruta: r.link_ruta || '', Estado: r.estado, Cargados: r.cargados ?? 0, Entregados: r.entregados ?? '', No_entregados: r.no_entregados ?? '',
  Km_inicio: r.km_inicio ?? '', Km_fin: r.km_fin ?? '', Hora_salida: fmtTs(r.hora_salida), Hora_cierre: fmtTs(r.hora_cierre), Notas: r.notas || ''
});
const mVan = v => ({
  ID: v.id, Alias: v.alias, Marca: v.marca || '', Modelo: v.modelo || '', Anio: v.anio ?? '', Placas: v.placas || '', Km_actual: v.km_actual ?? 0,
  Proximo_servicio_km: v.proximo_servicio_km ?? '', Seguro_vence: v.seguro_vence || '', Verificacion_vence: v.verificacion_vence || '', Tenencia_vence: v.tenencia_vence || '',
  GPS_link: v.gps_link || '', Activa: sino(v.activa), Notas: v.notas || '', Capacidad_tanque: v.capacidad_tanque ?? ''
});
const mUser = u => ({ ID: u.id, Nombre: u.nombre, Usuario: u.usuario, Rol: u.rol, Telefono: u.telefono || '', Licencia_vence: u.licencia_vence || '', Sueldo_semanal: u.sueldo_semanal ?? '', Activo: sino(u.activo), Creado: fmtTs(u.creado) });
const mGasto = g => ({ ID: g.id, Fecha: g.fecha, Categoria: g.categoria, Concepto: g.concepto || '', Monto: Number(g.monto), Meses: g.meses, Van_ID: g.van_id || '', Chofer_ID: g.chofer_id || '', Ruta_ID: g.ruta_id || '', Litros: g.litros ?? '', Km: g.km ?? '', Foto: g.foto || '', Registro: g.registro || '', Timestamp: fmtTs(g.ts) });
const mIncid = i => ({ ID: i.id, Timestamp: fmtTs(i.ts), Fecha: i.fecha, Ruta_ID: i.ruta_id, Chofer_ID: i.chofer_id, Chofer: i.chofer ? i.chofer.nombre : '', Codigo: i.codigo || '', Motivo: i.motivo, Comentario: i.comentario || '', Foto: i.foto || '', Lat: i.lat ?? '', Lng: i.lng ?? '', Resuelta: sino(i.resuelta) });
const mCheck = c => ({ ID: c.id, Timestamp: fmtTs(c.ts), Fecha: c.fecha, Ruta_ID: c.ruta_id, Van_ID: c.van_id, Chofer_ID: c.chofer_id, Chofer: c.chofer ? c.chofer.nombre : '', Km: c.km, Llantas: c.llantas, Luces: c.luces, Aceite: c.aceite, Golpes: c.golpes, Limpieza: c.limpieza, Fallas: c.fallas || '', Comentario: c.comentario || '', Foto: c.foto || '' });
const mMant = m => ({ ID: m.id, Fecha: m.fecha, Van_ID: m.van_id, Tipo: m.tipo, Km: m.km, Costo: Number(m.costo || 0), Taller: m.taller || '', Proximo_km: m.proximo_km ?? '', Notas: m.notas || '' });
const mPago = p => ({ ID: p.id, Fecha: p.fecha, Desde: p.desde || '', Hasta: p.hasta || '', Paquetes: p.paquetes ?? '', Monto: Number(p.monto), Referencia: p.referencia || '', Notas: p.notas || '' });
const mMsg = m => ({ ID: m.id, Timestamp: fmtTs(m.ts), De_ID: m.de_id, Para_ID: m.para_id || 'admin', Texto: m.texto, Leido: sino(m.leido) });
const RUTA_SEL = '*, chofer:perfiles(nombre), van:vans(alias)';

async function getConfig() {
  const rows = await q(sb.from('config').select('*'));
  const o = {}; rows.forEach(r => o[r.clave] = r.valor); return o;
}
async function catalogos() {
  const [us, vs] = await Promise.all([
    q(sb.from('perfiles').select('id, nombre, rol').eq('activo', true).order('nombre')),
    q(sb.from('vans').select('id, alias, placas').eq('activa', true).order('alias'))
  ]);
  return { choferes: us.map(u => ({ ID: u.id, Nombre: u.nombre, Rol: u.rol })), vans: vs.map(v => ({ ID: v.id, Alias: v.alias, Placas: v.placas || '' })), categorias: CATEGORIAS };
}
// Todo lo necesario para KPIs y alertas en un rango (y el periodo anterior de igual duración)
async function datosKpi(desde, hasta) {
  const len = FK.dayNum(hasta) - FK.dayNum(desde) + 1;
  const d0 = FK.addDays(desde, -len);
  const dGastos = FK.addDays(d0, -400); // gastos de varios meses (seguro anual) que caen en el rango
  const hoy = today(), hastaQ = hasta > hoy ? hasta : hoy;
  const [rutas, gastos, incid, checks, vans, pagos, users, cfg] = await Promise.all([
    all(() => sb.from('rutas').select(RUTA_SEL).gte('fecha', d0).lte('fecha', hasta).order('fecha')),
    all(() => sb.from('gastos').select('*').gte('fecha', dGastos).lte('fecha', hasta).order('fecha')),
    all(() => sb.from('incidencias').select('id, fecha, ruta_id, chofer_id, motivo').gte('fecha', d0).lte('fecha', hasta)),
    all(() => sb.from('checklists').select('id, fecha, ruta_id, van_id, chofer_id, fallas, foto, chofer:perfiles(nombre)').gte('fecha', d0).lte('fecha', hastaQ).order('ts')),
    q(sb.from('vans').select('*').order('alias')),
    all(() => sb.from('pagos_ml').select('*').gte('fecha', d0).lte('fecha', hasta)),
    q(sb.from('perfiles').select('*').order('nombre')),
    getConfig()
  ]);
  return {
    cfg, D: {
      rutas: rutas.map(mRuta), gastos: gastos.map(mGasto),
      incid: incid.map(i => ({ ID: i.id, Fecha: i.fecha, Ruta_ID: i.ruta_id, Chofer_ID: i.chofer_id, Motivo: i.motivo })),
      checks: checks.map(mCheck), vans: vans.map(mVan), pagos: pagos.map(mPago), users: users.map(mUser)
    }
  };
}

/* ---------- acciones ---------- */
const A = {};
/* sesión */
A['estado'] = async () => {
  const { data, error } = await sb.functions.invoke('usuarios', { body: { action: 'estado' } });
  if (error) throw new Error('No se pudo conectar con el servidor'); return data;
};
A['bootstrap'] = async d => {
  const { data, error } = await sb.functions.invoke('usuarios', { body: { action: 'bootstrap', data: d } });
  if (error) { let m = 'No se pudo crear'; try { m = (await error.context.json()).error || m; } catch (e) { } throw new Error(m); }
  return data;
};
A['login'] = async d => {
  const usuario = String(d.usuario || '').trim().toLowerCase(), pin = String(d.pin || '').trim();
  if (!usuario || !pin) throw new Error('Escribe usuario y PIN');
  const { error } = await sb.auth.signInWithPassword({ email: `${usuario}@${DOMINIO}`, password: pin });
  if (error) throw new Error(/rate|many/i.test(error.message) ? 'Demasiados intentos. Espera unos minutos.' : 'Usuario o PIN incorrecto');
  ME = null;
  const u = await me();
  return { token: 'supabase', user: u };
};
A['logout'] = async () => { ME = null; await sb.auth.signOut(); return true; };
A['sesion'] = async () => { ME = null; return await me(); };

/* chofer */
A['chofer.home'] = async () => {
  const u = await me();
  const h = await q(sb.rpc('chofer_home'));
  const r = h.ruta;
  return {
    user: { id: u.id, nombre: u.nombre }, motivos: h.motivos, noLeidos: h.noLeidos, ultimos: h.ultimos || [], checklist: !!h.checklist,
    ruta: r ? { ID: r.id, Fecha: r.fecha, Zona: r.zona || '', Link_ruta: r.link_ruta || '', Estado: r.estado, Cargados: r.cargados ?? 0, Entregados: r.entregados ?? '', No_entregados: r.no_entregados ?? '', Km_inicio: r.km_inicio ?? '', Hora_cierre: fmtTs(r.hora_cierre) } : null,
    van: h.van ? { Alias: h.van.alias, Placas: h.van.placas || '', Km_actual: h.van.km_actual } : null
  };
};
A['chofer.scan'] = d => q(sb.rpc('chofer_scan', { p_ruta: d.rutaId, p_texto: String(d.texto || '') }));
A['chofer.checklist'] = async d => {
  const foto = await subirFoto(d.foto, 'checklist');
  const items = {}; ['Llantas', 'Luces', 'Aceite', 'Golpes', 'Limpieza'].forEach(k => items[k.toLowerCase()] = d[k]);
  return q(sb.rpc('chofer_checklist', { p_ruta: d.rutaId, p_km: nnum(d.km), p_items: items, p_comentario: nz(d.comentario), p_foto: foto }));
};
A['chofer.incidencia'] = async d => {
  const foto = await subirFoto(d.foto, 'incidencia');
  return q(sb.rpc('chofer_incidencia', { p_ruta: d.rutaId, p_motivo: d.motivo, p_codigo: nz(d.codigo), p_comentario: nz(d.comentario), p_foto: foto, p_lat: d.lat ?? null, p_lng: d.lng ?? null }));
};
A['chofer.gasolina'] = async d => {
  if (!d.foto) throw new Error('Toma foto del ticket');
  if (!(nnum(d.km) > 0 && nnum(d.litros) > 0 && nnum(d.monto) > 0)) throw new Error('Captura km, litros y monto');
  const foto = await subirFoto(d.foto, 'ticket');
  return q(sb.rpc('chofer_gasolina', { p_ruta: d.rutaId, p_km: nnum(d.km), p_litros: nnum(d.litros), p_monto: nnum(d.monto), p_foto: foto }));
};
A['chofer.cerrar'] = d => q(sb.rpc('chofer_cerrar', { p_ruta: d.rutaId, p_km_fin: nnum(d.kmFin), p_entregados: nint(d.entregados), p_no_entregados: nint(d.noEntregados), p_notas: nz(d.notas) }));
A['chofer.mensajes'] = async () => (await q(sb.rpc('leer_mensajes'))).map(mMsg);
A['chofer.enviar'] = d => q(sb.rpc('chofer_enviar', { p_texto: String(d.texto || '') }));

/* admin */
A['admin.inicio'] = async () => {
  const hoy = today();
  const { cfg, D } = await datosKpi(FK.addDays(hoy, -34), hoy);
  const [abiertas, incHoy, noLeidos, mapa] = await Promise.all([
    q(sb.from('incidencias').select('id', { count: 'exact', head: true }).eq('resuelta', false).then(r => ({ data: r.count, error: r.error }))),
    q(sb.from('incidencias').select('id', { count: 'exact', head: true }).eq('fecha', hoy).then(r => ({ data: r.count, error: r.error }))),
    q(sb.from('mensajes').select('id', { count: 'exact', head: true }).is('para_id', null).eq('leido', false).then(r => ({ data: r.count, error: r.error }))),
    q(sb.rpc('admin_mapa', { p_fecha: hoy }))
  ]);
  const alertas = FK.operativas(D, mapa || []).concat(FK.alertas(cfg, D));
  alertas.sort((a, b) => (a.nivel === 'rojo' ? 0 : 1) - (b.nivel === 'rojo' ? 0 : 1));
  const rutas = D.rutas.filter(r => r.Fecha === hoy && r.Estado !== 'Cancelada');
  const k = FK.adminKpis({ desde: hoy.slice(0, 8) + '01', hasta: hoy }, D, cfg);
  const sum = (a, key) => a.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  return {
    hoy, negocio: cfg.Nombre_negocio, rutas: rutas.length,
    enRuta: rutas.filter(r => r.Estado === 'En ruta').length, cerradas: rutas.filter(r => r.Estado === 'Cerrada').length,
    cargados: sum(rutas, 'Cargados'), entregados: sum(rutas.filter(r => r.Estado === 'Cerrada'), 'Entregados'),
    incidHoy: incHoy || 0, incidAbiertas: abiertas || 0, noLeidos: noLeidos || 0,
    alertas, insights: FK.insights(D, cfg), salud: k.salud, brujulas: k.kpis.filter(x => x.brujula), resumenMes: k.resumen, tarifaConfigurada: k.tarifaConfigurada
  };
};
A['admin.mapa'] = async d => q(sb.rpc('admin_mapa', { p_fecha: d.fecha || today() }));
A['chofer.ubicacion'] = d => q(sb.rpc('chofer_ubicacion', { p_ruta: d.rutaId, p_lat: d.lat, p_lng: d.lng, p_precision: d.precision ?? null, p_velocidad: d.velocidad ?? null }));
A['admin.kpis'] = async d => {
  const hoy = today(), hasta = d.hasta || hoy, desde = d.desde || hasta.slice(0, 8) + '01';
  const { cfg, D } = await datosKpi(desde, hasta);
  return FK.adminKpis({ desde, hasta }, D, cfg);
};
A['admin.rutas'] = async d => {
  const fecha = d.fecha || today();
  const [rutas, cat] = await Promise.all([q(sb.from('rutas').select(RUTA_SEL).eq('fecha', fecha).order('creado')), catalogos()]);
  const ids = rutas.map(r => r.id);
  const [inc, chk] = ids.length ? await Promise.all([
    q(sb.from('incidencias').select('ruta_id').in('ruta_id', ids)), q(sb.from('checklists').select('ruta_id').in('ruta_id', ids))
  ]) : [[], []];
  return {
    fecha, catalogos: cat,
    rutas: rutas.map(r => Object.assign(mRuta(r), { incidencias: inc.filter(i => i.ruta_id === r.id).length, checklist: chk.some(c => c.ruta_id === r.id) }))
  };
};
A['admin.ruta'] = async d => {
  const r = await q(sb.from('rutas').select(RUTA_SEL).eq('id', d.id).maybeSingle());
  if (!r) throw new Error('No existe la ruta');
  const [paq, inc, chk, cat] = await Promise.all([
    all(() => sb.from('paquetes').select('codigo, ts').eq('ruta_id', r.id).order('id')),
    q(sb.from('incidencias').select('*, chofer:perfiles(nombre)').eq('ruta_id', r.id).order('ts')),
    q(sb.from('checklists').select('*, chofer:perfiles(nombre)').eq('ruta_id', r.id).limit(1)),
    catalogos()
  ]);
  const incidencias = await firmar(inc.map(mIncid), 'Foto');
  const checklist = chk.length ? (await firmar([mCheck(chk[0])], 'Foto'))[0] : null;
  return { ruta: mRuta(r), paquetes: paq.map(p => ({ Codigo: p.codigo, Hora: fmtTs(p.ts).slice(11, 16) })), incidencias, checklist, catalogos: cat };
};
A['admin.guardarRuta'] = async d => {
  const row = { fecha: d.Fecha, zona: nz(d.Zona), chofer_id: d.Chofer_ID, van_id: d.Van_ID, link_ruta: nz(d.Link_ruta), notas: nz(d.Notas) };
  if (d.ID) {
    Object.assign(row, { estado: d.Estado, entregados: nint(d.Entregados), no_entregados: nint(d.No_entregados), km_inicio: nnum(d.Km_inicio), km_fin: nnum(d.Km_fin) });
    if (d.Estado === 'Cerrada') {
      const prev = await q(sb.from('rutas').select('hora_cierre').eq('id', d.ID).single());
      if (!prev.hora_cierre) row.hora_cierre = new Date().toISOString();
    }
    await q(sb.from('rutas').update(row).eq('id', d.ID));
    return true;
  }
  if (!d.Fecha || !d.Chofer_ID || !d.Van_ID) throw new Error('Elige fecha, chofer y van');
  await q(sb.from('rutas').insert(row));
  return true;
};
A['admin.duplicarRutas'] = async d => {
  const a = d.a || today(), desde = d.desde || FK.addDays(a, -1);
  const n = await q(sb.rpc('admin_duplicar_rutas', { p_desde: desde, p_a: a }));
  return { creadas: n, desde };
};
A['admin.vans'] = async () => {
  const hoy = today(), d0 = FK.addDays(hoy, -29);
  const [vans, rutas, gastos, checks, cfg] = await Promise.all([
    q(sb.from('vans').select('*').order('alias')),
    all(() => sb.from('rutas').select(RUTA_SEL).gte('fecha', d0).lte('fecha', hoy)),
    all(() => sb.from('gastos').select('*').gte('fecha', FK.addDays(d0, -400)).lte('fecha', hoy)),
    all(() => sb.from('checklists').select('fecha, van_id, ruta_id, fallas, foto').order('ts', { ascending: false }).limit(200)),
    getConfig()
  ]);
  const D = { rutas: rutas.map(mRuta), gastos: gastos.map(mGasto), incid: [], checks: checks.map(c => ({ Ruta_ID: c.ruta_id })), vans: vans.map(mVan), pagos: [], users: [] };
  const m = FK.metrics(d0, hoy, D, cfg);
  const dias = FK.num(cfg.Dias_alerta_vencimiento) || 30;
  const out = vans.map(v => {
    const o = mVan(v);
    const st = m.vansDet.find(x => x.id === v.id) || {};
    o.km30 = st.km || 0; o.rend30 = st.rend || null; o.rutas30 = st.rutas || 0; o.mant30 = st.mant || 0;
    o.alertas = FK.alertasVan(o, dias);
    const ult = checks.find(c => c.van_id === v.id);
    o.ultimoChecklist = ult ? { fecha: ult.fecha, fallas: ult.fallas || '', foto: '' } : null;
    return o;
  });
  return { vans: out, gps: cfg.GPS_link || '', intervalo: FK.num(cfg.Intervalo_servicio_km) || 10000 };
};
A['admin.guardarVan'] = async d => {
  if (!d.Alias) throw new Error('Ponle un nombre a la van (ej. Van 1)');
  const row = {
    alias: d.Alias, marca: nz(d.Marca), modelo: nz(d.Modelo), anio: nint(d.Anio), placas: nz(d.Placas), km_actual: nnum(d.Km_actual) ?? 0,
    proximo_servicio_km: nnum(d.Proximo_servicio_km), seguro_vence: nz(d.Seguro_vence), verificacion_vence: nz(d.Verificacion_vence), tenencia_vence: nz(d.Tenencia_vence),
    gps_link: nz(d.GPS_link), notas: nz(d.Notas), capacidad_tanque: nnum(d.Capacidad_tanque)
  };
  if (d.Activa !== undefined) row.activa = d.Activa === 'Sí';
  if (d.ID) { await q(sb.from('vans').update(row).eq('id', d.ID)); return true; }
  if (row.proximo_servicio_km === null) { const cfg = await getConfig(); row.proximo_servicio_km = row.km_actual + (FK.num(cfg.Intervalo_servicio_km) || 10000); }
  await q(sb.from('vans').insert(row));
  return true;
};
A['admin.vanHistorial'] = async d => {
  const [rutas, mant, comb] = await Promise.all([
    q(sb.from('rutas').select(RUTA_SEL).eq('van_id', d.id).eq('estado', 'Cerrada').order('fecha', { ascending: false }).limit(40)),
    q(sb.from('mantenimientos').select('*').eq('van_id', d.id).order('fecha', { ascending: false })),
    q(sb.from('gastos').select('*').eq('van_id', d.id).eq('categoria', 'Combustible').order('fecha', { ascending: false }).limit(30))
  ]);
  const combustible = await firmar(comb.map(g => ({ Fecha: g.fecha, Litros: Number(g.litros || 0), Monto: Number(g.monto), Km: Number(g.km || 0), Foto: g.foto || '', Registro: g.registro || '' })), 'Foto');
  return { rutas: rutas.map(mRuta).map(r => ({ Fecha: r.Fecha, Zona: r.Zona, Chofer: r.Chofer, Km: FK.kmRuta(r), Entregados: Number(r.Entregados) || 0 })), mantenimientos: mant.map(mMant), combustible };
};
A['admin.mantenimiento'] = d => q(sb.rpc('admin_mantenimiento', { p_van: d.Van_ID, p_tipo: d.Tipo, p_fecha: nz(d.Fecha), p_km: nnum(d.Km), p_costo: nnum(d.Costo), p_proximo: nnum(d.Proximo_km), p_taller: nz(d.Taller), p_notas: nz(d.Notas) }));
A['admin.usuarios'] = async () => (await q(sb.from('perfiles').select('*').order('rol').order('nombre'))).map(mUser);
A['admin.guardarUsuario'] = async d => {
  if (!d.ID) {
    const { data, error } = await sb.functions.invoke('usuarios', { body: { action: 'crear', data: { nombre: d.Nombre, usuario: d.Usuario, pin: d.PIN, rol: d.Rol, telefono: nz(d.Telefono), licencia_vence: nz(d.Licencia_vence), sueldo_semanal: nnum(d.Sueldo_semanal) } } });
    if (error) { let m = 'No se pudo crear'; try { m = (await error.context.json()).error || m; } catch (e) { } throw new Error(m); }
    return data;
  }
  const row = { nombre: d.Nombre, telefono: nz(d.Telefono), licencia_vence: nz(d.Licencia_vence), sueldo_semanal: nnum(d.Sueldo_semanal), rol: d.Rol === 'admin' ? 'admin' : 'chofer' };
  if (d.Activo !== undefined) row.activo = d.Activo === 'Sí';
  if (d.PIN && !/^\d{6}$/.test(d.PIN)) throw new Error('El PIN debe tener exactamente 6 números');
  await q(sb.from('perfiles').update(row).eq('id', d.ID));
  if (d.PIN) {
    const { error } = await sb.functions.invoke('usuarios', { body: { action: 'pin', data: { id: d.ID, pin: d.PIN } } });
    if (error) throw new Error('Se guardaron los datos pero no se pudo cambiar el PIN');
  }
  return true;
};
A['admin.gastos'] = async d => {
  const hoy = today(), desde = d.desde || hoy.slice(0, 8) + '01', hasta = d.hasta || hoy;
  const [rows, cat] = await Promise.all([all(() => sb.from('gastos').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha', { ascending: false }).order('ts', { ascending: false })), catalogos()]);
  const gastos = await firmar(rows.map(mGasto), 'Foto');
  const porCategoria = {}; let total = 0;
  gastos.forEach(g => { porCategoria[g.Categoria] = (porCategoria[g.Categoria] || 0) + g.Monto; total += g.Monto; });
  return { desde, hasta, gastos, total, porCategoria, catalogos: cat };
};
A['admin.guardarGasto'] = async d => {
  const monto = nnum(d.Monto);
  if (!(monto > 0)) throw new Error('Captura el monto');
  if (!CATEGORIAS.includes(d.Categoria)) throw new Error('Elige la categoría');
  const row = { fecha: d.Fecha || today(), categoria: d.Categoria, concepto: nz(d.Concepto) || d.Categoria, monto, meses: Math.max(1, nint(d.Meses) || 1), van_id: nz(d.Van_ID), chofer_id: nz(d.Chofer_ID), litros: nnum(d.Litros), km: nnum(d.Km) };
  if (d.ID) { await q(sb.from('gastos').update(row).eq('id', d.ID)); return true; }
  row.registro = (await me()).nombre;
  await q(sb.from('gastos').insert(row));
  return true;
};
A['admin.pagos'] = async () => (await q(sb.from('pagos_ml').select('*').order('fecha', { ascending: false }))).map(mPago);
A['admin.guardarPago'] = async d => {
  const monto = nnum(d.Monto);
  if (!(monto > 0)) throw new Error('Captura el monto');
  await q(sb.from('pagos_ml').insert({ fecha: d.Fecha || today(), desde: nz(d.Desde), hasta: nz(d.Hasta), paquetes: nint(d.Paquetes), monto, referencia: nz(d.Referencia), notas: nz(d.Notas) }));
  return true;
};
A['admin.eliminar'] = async d => {
  const t = { Gastos: 'gastos', Pagos_ML: 'pagos_ml', Mantenimientos: 'mantenimientos' }[d.hoja];
  if (!t) throw new Error('No se puede eliminar en esa sección');
  if (t === 'mantenimientos') {
    const m = await q(sb.from('mantenimientos').select('gasto_id').eq('id', d.id).maybeSingle());
    await q(sb.from('mantenimientos').delete().eq('id', d.id));
    if (m && m.gasto_id) await q(sb.from('gastos').delete().eq('id', m.gasto_id));
    return true;
  }
  await q(sb.from(t).delete().eq('id', d.id));
  return true;
};
A['admin.incidencias'] = async d => {
  let qb = sb.from('incidencias').select('*, chofer:perfiles(nombre)').order('ts', { ascending: false }).limit(150);
  if (!d.todas) qb = qb.eq('resuelta', false);
  return firmar((await q(qb)).map(mIncid), 'Foto');
};
A['admin.resolver'] = d => q(sb.from('incidencias').update({ resuelta: true }).eq('id', d.id));
A['admin.conversaciones'] = async () => (await q(sb.rpc('admin_conversaciones'))).map(c => ({ ID: c.id, Nombre: c.nombre, Activo: c.activo, ultimo: c.ultimo_ts ? { Texto: c.ultimo_texto, Timestamp: fmtTs(c.ultimo_ts) } : null, noLeidos: Number(c.no_leidos) }));
A['admin.mensajes'] = async d => (await q(sb.rpc('leer_mensajes', { p_con: d.choferId }))).map(mMsg);
A['admin.enviar'] = async d => {
  const t = String(d.texto || '').trim(); if (!t) throw new Error('Mensaje vacío');
  await q(sb.from('mensajes').insert({ de_id: (await me()).id, para_id: d.choferId, texto: t.slice(0, 1000) }));
  return true;
};
A['admin.config'] = async () => (await q(sb.from('config').select('*').order('clave'))).map(c => ({ Clave: c.clave, Valor: c.valor, Descripcion: c.descripcion || '' }));
A['admin.guardarConfig'] = async d => {
  const rows = Object.keys(d || {}).map(k => ({ clave: k, valor: String(d[k] ?? '') }));
  if (rows.length) await q(sb.from('config').upsert(rows, { onConflict: 'clave', ignoreDuplicates: false }).select('clave'));
  return true;
};

export async function api(action, data) {
  const fn = A[action];
  if (!fn) throw new Error('Acción no válida');
  return fn(data || {});
}
export const PANEL_URL = 'https://supabase.com/dashboard/project/' + (SUPABASE_URL.match(/https:\/\/([^.]+)\./) || [])[1] + '/editor';
export function resetMe() { ME = null; }
