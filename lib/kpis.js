/* Motor de KPIs, diagnóstico y plan de crecimiento. */
/* Motor de KPIs, diagnóstico y plan (portado 1:1 del backend probado). */
// @ts-nocheck
const VARIABLES = ['Combustible', 'Mantenimiento', 'Llantas', 'Reparaciones', 'Casetas', 'Multas'];
const NOMINA = ['Sueldos', 'IMSS/Prestaciones'];
const MANTTO = ['Mantenimiento', 'Llantas', 'Reparaciones'];
const MOTIVOS = ['No estaba / no atendió', 'Rechazó / no recibió', 'Dirección incorrecta', 'Zona insegura / sin acceso', 'Paquete dañado', 'Otro'];

const CONFIG_DEFAULTS = [
  ['Nombre_negocio', '[POR LLENAR]', 'Nombre comercial de la flotilla'],
  ['Tarifa_por_paquete', '0', 'Lo que te paga Mercado Libre por paquete entregado, en MXN [POR LLENAR]'],
  ['Costo_van_nueva', '0', 'Inversión por cada van adicional, para calcular en cuánto se paga [POR LLENAR]'],
  ['Intervalo_servicio_km', '10000', 'Cada cuántos km toca servicio (ajústalo al manual de tus vans)'],
  ['Meta_tasa_entrega', '0.95', 'Meta de entregas efectivas (0.95 = 95%). Ajústala con tus datos'],
  ['Meta_margen', '0.20', 'Meta de margen operativo (0.20 = 20%). Ajústala con tus datos'],
  ['Meta_utilizacion', '0.85', 'Meta de uso de flota: % de días que trabaja cada van (0.85 = 85%)'],
  ['Dias_alerta_vencimiento', '30', 'Días de anticipación para avisarte de seguros, verificación, licencias'],
  ['GPS_link', '', 'Link de la plataforma de GPS de tus vans'],
  ['Carpeta_fotos_ID', '', '(Automático) Carpeta de Google Drive donde se guardan las fotos']
];

const ACCION_MOTIVO = {
  'No estaba / no atendió': 'Revisa el orden de la ruta: zona comercial temprano y residencial más tarde. Pide foto de la fachada en cada caso como evidencia ante ML.',
  'Rechazó / no recibió': 'Documenta cada rechazo con foto y comentario. Si se concentra en un chofer, revisa su trato y su horario de llegada.',
  'Dirección incorrecta': 'Repórtalo a tu coordinador de ML el mismo día con foto y referencia. Si se repite en una colonia, pide corrección de esa zona.',
  'Zona insegura / sin acceso': 'Define horarios seguros para esa zona y coméntalo con tu coordinador de ML antes de que afecte tu calificación.',
  'Paquete dañado': 'Revisa el acomodo en la van (pesados abajo, separadores) y toma foto al cargar si el paquete ya viene dañado del centro.',
  'Otro': 'Lee los comentarios de esas incidencias con los choferes para encontrar el patrón.'
};
const ACCION_GASTO = {
  'Combustible': 'Rutas más compactas, presión de llantas cada semana, motor apagado en cada entrega y compara km del GPS contra los tickets.',
  'Sueldos': 'Considera sueldo base + bono por paquete entregado: parte del costo se vuelve variable y premias productividad.',
  'IMSS/Prestaciones': 'Revisa con tu contador que los salarios registrados y el esquema de bonos estén bien estructurados.',
  'Mantenimiento': 'Pasa a mantenimiento preventivo por km y cotiza con 2 o 3 talleres; lo correctivo sale más caro y te para la van.',
  'Reparaciones': 'Revisa los checklists: si hay golpes o fallas recurrentes, identifica chofer y causa.',
  'Llantas': 'Revisa presión y alineación; un desgaste rápido suele venir de presión baja o alineación.',
  'Seguro': 'Al renovar, cotiza póliza de flotilla con 2 o 3 aseguradoras.'
};


/* ====================== ALERTAS ====================== */
function alertasVan_(v, diasAviso) {
  const out = [];
  const km = num_(v.Km_actual), prox = num_(v.Proximo_servicio_km);
  if (prox > 0) {
    const falta = prox - km;
    if (falta <= 0) out.push({ nivel: 'rojo', texto: 'Servicio vencido por ' + fmtNum_(-falta) + ' km' });
    else if (falta <= 500) out.push({ nivel: 'amarillo', texto: 'Servicio en ' + fmtNum_(falta) + ' km' });
  }
  [['Seguro_vence', 'Seguro'], ['Verificacion_vence', 'Verificación'], ['Tenencia_vence', 'Tenencia/placas']].forEach(function (p) {
    const f = String(v[p[0]] || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return;
    const dd = dayNum_(f) - dayNum_(today_());
    if (dd < 0) out.push({ nivel: 'rojo', texto: p[1] + ' vencido desde ' + f });
    else if (dd <= diasAviso) out.push({ nivel: 'amarillo', texto: p[1] + ' vence en ' + dd + ' días' });
  });
  return out;
}

function alertas_(cfg, D) {
  const dias = num_(cfg.Dias_alerta_vencimiento) || 30;
  const out = [];
  if (!(num_(cfg.Tarifa_por_paquete) > 0)) out.push({ nivel: 'amarillo', texto: 'Captura tu tarifa por paquete en Configuración para ver ingresos y utilidad', donde: 'config' });
  D.vans.filter(function (v) { return truthy_(v.Activa); }).forEach(function (v) {
    alertasVan_(v, dias).forEach(function (a) { out.push({ nivel: a.nivel, texto: v.Alias + ': ' + a.texto, donde: 'flota' }); });
  });
  D.users.filter(function (u) { return truthy_(u.Activo) && u.Rol === 'chofer'; }).forEach(function (u) {
    const f = String(u.Licencia_vence || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return;
    const dd = dayNum_(f) - dayNum_(today_());
    if (dd < 0) out.push({ nivel: 'rojo', texto: 'Licencia de ' + u.Nombre + ' vencida', donde: 'choferes' });
    else if (dd <= dias) out.push({ nivel: 'amarillo', texto: 'Licencia de ' + u.Nombre + ' vence en ' + dd + ' días', donde: 'choferes' });
  });
  const hoy = today_();
  D.checks.filter(function (c) { return c.Fecha === hoy && c.Fallas; }).forEach(function (c) {
    out.push({ nivel: 'rojo', texto: 'Checklist con falla (' + c.Fallas + ') · ' + c.Chofer, donde: 'rutas' });
  });
  out.sort(function (a, b) { return (a.nivel === 'rojo' ? 0 : 1) - (b.nivel === 'rojo' ? 0 : 1); });
  return out;
}

/* ====================== KPIs, DIAGNÓSTICO Y PLAN ====================== */
function adminKpis_(d, D, cfg) {
  const hoy = today_();
  const hasta = d.hasta || hoy;
  const desde = d.desde || hasta.slice(0, 8) + '01';
  if (dayNum_(desde) > dayNum_(hasta)) throw err_('La fecha inicial es mayor a la final');
  const len = dayNum_(hasta) - dayNum_(desde) + 1;
  const cur = metrics_(desde, hasta, D, cfg);
  const prev = metrics_(addDays_(desde, -len), addDays_(desde, -1), D, cfg);
  const kpis = buildKpis_(cur, prev, cfg);
  if (cur.cerradas === 0) kpis.forEach(function (k) { k.estado = 'gris'; k.lectura = 'Sin rutas cerradas en este periodo.'; });
  const alertasRojas = alertas_(cfg, D).filter(function (a) { return a.nivel === 'rojo'; }).length;
  return {
    desde: desde, hasta: hasta, dias: len,
    tarifaConfigurada: num_(cfg.Tarifa_por_paquete) > 0,
    resumen: {
      ingreso: cur.ingreso, costos: cur.costos, utilidad: cur.utilidad, margen: cur.margen, entregados: cur.ent, cargados: cur.cargados,
      km: cur.km, rutas: cur.cerradas, diasOperados: cur.diasOp, vanDias: cur.vanDias, pagado: cur.pagado, pendiente: cur.pendiente
    },
    kpis: kpis,
    salud: salud_(kpis),
    plan: plan_(cur, prev, cfg, alertasRojas),
    rutas: cur.rutasDet.slice().reverse().slice(0, 60),
    zonas: cur.zonas, choferes: cur.choferes, vans: cur.vansDet,
    diario: cur.diario, gastosCat: cur.gastosCat, motivos: cur.motivos
  };
}

function metrics_(desde, hasta, D, cfg) {
  const tarifa = num_(cfg.Tarifa_por_paquete);
  const d0 = dayNum_(desde), d1 = dayNum_(hasta), dias = d1 - d0 + 1;
  const inR = function (f) { const n = dayNum_(String(f || '').slice(0, 10)); return n >= d0 && n <= d1; };
  const rutas = D.rutas.filter(function (r) { return inR(r.Fecha) && r.Estado !== 'Cancelada'; });
  const cerr = rutas.filter(function (r) { return r.Estado === 'Cerrada'; });
  const checkIds = {};
  D.checks.forEach(function (c) { checkIds[c.Ruta_ID] = true; });

  let cargados = 0, ent = 0, noEnt = 0, cargT = 0, entT = 0, km = 0, entKm = 0, horas = 0, entH = 0, sinKm = 0, conCheck = 0;
  const vanDiaSet = {}, diaSet = {};
  cerr.forEach(function (r) {
    const c = num_(r.Cargados), e = num_(r.Entregados);
    cargados += c; ent += e; noEnt += num_(r.No_entregados);
    if (c > 0) { cargT += c; entT += e; }
    const k = kmRuta_(r);
    if (k !== null) { km += k; entKm += e; } else sinKm++;
    const h = horasEntre_(r.Hora_salida, r.Hora_cierre);
    if (h > 0 && h < 20) { horas += h; entH += e; }
    if (checkIds[r.ID]) conCheck++;
    const f = String(r.Fecha).slice(0, 10);
    vanDiaSet[f + '|' + r.Van_ID] = true; diaSet[f] = true;
  });
  const vanDias = Object.keys(vanDiaSet).length, diasOp = Object.keys(diaSet).length;

  let variables = 0, fijos = 0, nomina = 0, combustible = 0, mant = 0, litros = 0;
  const cat = {}, vg = {};
  const vgOf = function (id) { if (!vg[id]) vg[id] = { litros: 0, mant: 0, comb: 0 }; return vg[id]; };
  D.gastos.forEach(function (g) {
    const a = asignado_(g, d0, d1);
    if (!a) return;
    const k = g.Categoria || 'Otros';
    cat[k] = (cat[k] || 0) + a;
    if (VARIABLES.indexOf(k) >= 0) variables += a; else fijos += a;
    if (NOMINA.indexOf(k) >= 0) nomina += a;
    if (k === 'Combustible') { combustible += a; litros += num_(g.Litros); vgOf(g.Van_ID).litros += num_(g.Litros); vgOf(g.Van_ID).comb += a; }
    if (MANTTO.indexOf(k) >= 0) { mant += a; vgOf(g.Van_ID).mant += a; }
  });
  const costos = variables + fijos;
  const ingreso = ent * tarifa;
  const utilidad = ingreso - costos;
  const vansActivas = D.vans.filter(function (v) { return truthy_(v.Activa); }).length;

  const incid = D.incid.filter(function (i) { return inR(i.Fecha); });
  const motivos = {};
  incid.forEach(function (i) { motivos[i.Motivo] = (motivos[i.Motivo] || 0) + 1; });
  const motivosArr = Object.keys(motivos).map(function (k) { return { motivo: k, n: motivos[k] }; }).sort(function (a, b) { return b.n - a.n; });

  const pagado = D.pagos.filter(function (p) { return inR(p.Fecha); }).reduce(function (a, p) { return a + num_(p.Monto); }, 0);

  const cvu = div_(variables, ent);
  const mcu = tarifa - (cvu || 0);
  const cvKm = div_(variables, km);
  const fijoVD = vanDias ? fijos / vanDias : 0;

  // Detalle por ruta
  const rutasDet = cerr.map(function (r) {
    const e = num_(r.Entregados), k = kmRuta_(r);
    let h = horasEntre_(r.Hora_salida, r.Hora_cierre); if (!(h > 0 && h < 20)) h = null;
    const ing = e * tarifa;
    const cv = (k !== null && cvKm !== null) ? k * cvKm : (cvu !== null ? e * cvu : 0);
    const u = ing - cv - fijoVD;
    return {
      id: r.ID, fecha: String(r.Fecha).slice(0, 10), zona: r.Zona || 'Sin zona', chofer: r.Chofer, choferId: r.Chofer_ID, van: r.Van, vanId: r.Van_ID,
      cargados: num_(r.Cargados), entregados: e, km: k, horas: h, ingreso: ing, utilidad: u,
      utilKm: k ? u / k : null, paqHora: h ? e / h : null, kmPaq: (k && e) ? k / e : null
    };
  });

  const group = function (keyFn, nameFn) {
    const m = {};
    rutasDet.forEach(function (r) {
      const key = keyFn(r);
      if (!m[key]) m[key] = { id: key, nombre: nameFn(r), rutas: 0, cargados: 0, entregados: 0, entCarg: 0, km: 0, entKm: 0, horas: 0, entH: 0, ingreso: 0, utilidad: 0 };
      const g = m[key];
      g.rutas++; g.entregados += r.entregados; g.ingreso += r.ingreso; g.utilidad += r.utilidad;
      if (r.cargados > 0) { g.cargados += r.cargados; g.entCarg += r.entregados; }
      if (r.km !== null) { g.km += r.km; g.entKm += r.entregados; }
      if (r.horas) { g.horas += r.horas; g.entH += r.entregados; }
    });
    return Object.keys(m).map(function (k) {
      const g = m[k];
      g.tasa = div_(g.entCarg, g.cargados); g.utilKm = div_(g.utilidad, g.km); g.paqHora = div_(g.entH, g.horas);
      g.kmPaq = div_(g.km, g.entKm); g.entPorRuta = div_(g.entregados, g.rutas); g.utilPorRuta = div_(g.utilidad, g.rutas);
      return g;
    });
  };
  const zonas = group(function (r) { return r.zona; }, function (r) { return r.zona; }).sort(function (a, b) { return (b.utilKm || -1e9) - (a.utilKm || -1e9); });
  const choferes = group(function (r) { return r.choferId; }, function (r) { return r.chofer; }).map(function (g) {
    g.incidencias = incid.filter(function (i) { return i.Chofer_ID === g.id; }).length; return g;
  }).sort(function (a, b) { return (b.paqHora || 0) - (a.paqHora || 0); });
  const vansDet = group(function (r) { return r.vanId; }, function (r) { return r.van; }).map(function (g) {
    const x = vg[g.id] || { litros: 0, mant: 0, comb: 0 };
    g.litros = x.litros; g.mant = x.mant; g.comb = x.comb; g.rend = div_(g.km, x.litros);
    return g;
  });

  // Serie diaria
  const diarioMap = {};
  rutasDet.forEach(function (r) { if (!diarioMap[r.fecha]) diarioMap[r.fecha] = { ent: 0, km: 0 }; diarioMap[r.fecha].ent += r.entregados; diarioMap[r.fecha].km += (r.km || 0); });
  const diario = [];
  const fijoDia = fijos / dias;
  for (let n = Math.max(d0, d1 - 61); n <= d1; n++) {
    const f = dateFromNum_(n), x = diarioMap[f] || { ent: 0, km: 0 };
    const cv = (cvKm !== null && x.km) ? x.km * cvKm : (cvu !== null ? x.ent * cvu : 0);
    diario.push({ fecha: f, entregados: x.ent, ingreso: x.ent * tarifa, utilidad: x.ent * tarifa - cv - fijoDia });
  }

  const gastosCat = Object.keys(cat).map(function (k) { return { categoria: k, monto: cat[k], share: div_(cat[k], costos), variable: VARIABLES.indexOf(k) >= 0 }; }).sort(function (a, b) { return b.monto - a.monto; });

  return {
    tarifa: tarifa, dias: dias, diasOp: diasOp, vanDias: vanDias, vansActivas: vansActivas, cerradas: cerr.length, rutasTot: rutas.length,
    cargados: cargados, ent: ent, noEnt: noEnt, cargT: cargT, entT: entT, km: km, entKm: entKm, horas: horas, entH: entH, sinKm: sinKm, conCheck: conCheck,
    variables: variables, fijos: fijos, nomina: nomina, combustible: combustible, mant: mant, litros: litros, costos: costos, ingreso: ingreso, utilidad: utilidad,
    margen: ingreso > 0 ? utilidad / ingreso : null,
    tasa: div_(entT, cargT),
    incid: incid.length, incidRate: div_(incid.length, cargT || (ent + noEnt)),
    motivos: motivosArr,
    cvu: cvu, mcu: mcu, cvKm: cvKm,
    costoPaq: div_(costos, ent), utilPaq: div_(utilidad, ent),
    ingKm: div_(entKm * tarifa, km), costKm: div_(costos, km), utilKm: km > 0 ? (entKm * tarifa - costos * (entKm / Math.max(ent, 1))) / km : null,
    kmPaq: div_(km, entKm), paqHora: div_(entH, horas), paqVanDia: div_(ent, vanDias),
    utilDia: utilidad / dias, utilVanDia: div_(utilidad, vanDias), ingVanDia: div_(ingreso, vanDias),
    utilizacion: vansActivas ? vanDias / (vansActivas * dias) : null,
    rend: div_(km, litros), combKm: div_(combustible, km), mantKm: div_(mant, km), nominaPaq: div_(nomina, ent),
    checkCumpl: cerr.length ? conCheck / cerr.length : null,
    bePaqDia: (diasOp && mcu > 0) ? (fijos / diasOp) / mcu : null, paqDia: div_(ent, diasOp),
    fijosMes: fijos / dias * 30.4, utilVanMes: vansActivas ? utilidad / dias * 30.4 / vansActivas : null,
    pagado: pagado, pendiente: ingreso - pagado,
    rutasDet: rutasDet, zonas: zonas, choferes: choferes, vansDet: vansDet, diario: diario, gastosCat: gastosCat
  };
}

function buildKpis_(c, p, cfg) {
  const metaT = num_(cfg.Meta_tasa_entrega) || 0.95, metaM = num_(cfg.Meta_margen) || 0.2, metaU = num_(cfg.Meta_utilizacion) || 0.85;
  const t = c.tarifa;
  const L = [];
  const add = function (o) {
    o.prev = o.prevVal !== undefined ? o.prevVal : null; delete o.prevVal;
    o.cambio = (o.valor !== null && o.prev !== null && o.prev !== 0) ? (o.valor - o.prev) / Math.abs(o.prev) : null;
    if (o.valor === null || o.valor === undefined || (typeof o.valor === 'number' && !isFinite(o.valor))) {
      o.valor = null;
      if (!o.keep) { o.estado = 'gris'; o.lectura = 'Sin datos suficientes en este periodo. ' + (o.faltan || 'Cierra rutas en la app y registra gastos.'); }
    }
    delete o.faltan; delete o.keep;
    L.push(o);
  };
  const tend = function (val, prev, mejorSi) {
    if (val === null || prev === null || prev === 0) return 'gris';
    let ch = (val - prev) / Math.abs(prev);
    if (mejorSi === 'down') ch = -ch;
    return ch >= -0.05 ? 'verde' : (ch >= -0.15 ? 'amarillo' : 'rojo');
  };
  const sinTarifa = !(t > 0);

  /* --- DINERO --- */
  add({
    id: 'utilidad', seccion: 'Dinero', nombre: 'Utilidad del periodo', fmt: 'money', valor: sinTarifa ? null : c.utilidad, prevVal: p.ingreso ? p.utilidad : null, mejorSi: 'up',
    estado: c.utilidad < 0 ? 'rojo' : (c.margen !== null && c.margen >= metaM ? 'verde' : 'amarillo'),
    que: 'Lo que le queda a la empresa: ingresos (paquetes entregados × tarifa) menos todos los gastos del periodo.',
    lectura: 'Ingresaste ' + money_(c.ingreso) + ' (' + fmtNum_(c.ent) + ' paquetes × ' + money_(t, 2) + ') y gastaste ' + money_(c.costos) + '. ' + (c.utilidad >= 0 ? 'Te quedan ' : 'Perdiste ') + money_(Math.abs(c.utilidad)) + '.',
    faltan: sinTarifa ? 'Captura la tarifa por paquete en Configuración.' : undefined
  });
  add({
    id: 'margen', seccion: 'Dinero', nombre: 'Margen operativo', fmt: 'pct', valor: c.margen, prevVal: p.margen, mejorSi: 'up', meta: metaM,
    estado: c.margen === null ? 'gris' : (c.margen >= metaM ? 'verde' : (c.margen >= 0 ? 'amarillo' : 'rojo')),
    que: 'De cada $100 que te paga Mercado Libre, cuántos pesos te quedan después de todos los gastos.',
    lectura: c.margen === null ? '' : 'De cada $100 que entran te quedan $' + Math.round(c.margen * 100) + '. Tu meta es ' + pct_(metaM) + '. ' + (c.margen < metaM ? 'Revisa el plan de 3 meses para cerrar la diferencia.' : 'Vas en meta: el reto ahora es crecer sin bajarlo.')
  });
  add({
    id: 'utilDia', seccion: 'Dinero', nombre: 'Dinero ganado por día', fmt: 'money', valor: sinTarifa ? null : c.utilDia, prevVal: p.ingreso ? p.utilDia : null, mejorSi: 'up',
    estado: c.utilDia < 0 ? 'rojo' : tend(c.utilDia, p.ingreso ? p.utilDia : null, 'up'),
    que: 'Utilidad promedio por cada día del calendario (trabajado o no). Es lo que la empresa te genera al día.',
    lectura: 'La empresa genera en promedio ' + money_(c.utilDia) + ' de utilidad al día; al mes serían ≈ ' + money_(c.utilDia * 30.4) + '.'
  });
  add({
    id: 'utilVanDia', seccion: 'Dinero', brujula: true, nombre: 'Utilidad por van por día', fmt: 'money', valor: sinTarifa ? null : c.utilVanDia, prevVal: p.ingreso ? p.utilVanDia : null, mejorSi: 'up',
    estado: c.utilVanDia === null ? 'gris' : (c.utilVanDia <= 0 ? 'rojo' : tend(c.utilVanDia, p.ingreso ? p.utilVanDia : null, 'up')),
    que: 'Cuánto deja cada van en cada día que sale a trabajar, ya con su parte de gastos fijos. Es el número que dice si conviene meter más vans.',
    lectura: 'Cada van que sale a trabajar deja ' + money_(c.utilVanDia) + ' al día. ' + (c.utilVanDia > 0 ? 'Mientras sea positivo y estable, cada van adicional (con rutas aseguradas) suma utilidad.' : 'Hoy cada van que sale pierde dinero: primero hay que corregir costos o volumen.')
  });
  add({
    id: 'costoPaq', seccion: 'Dinero', brujula: true, nombre: 'Costo por paquete entregado', fmt: 'money2', valor: c.costoPaq, prevVal: p.costoPaq, mejorSi: 'down',
    estado: c.costoPaq === null || sinTarifa ? 'gris' : (c.costoPaq <= t * (1 - metaM) ? 'verde' : (c.costoPaq < t ? 'amarillo' : 'rojo')),
    que: 'Todos los gastos del periodo divididos entre los paquetes entregados. Debe ser menor a lo que te paga ML por paquete.',
    lectura: 'Te cuesta ' + money_(c.costoPaq, 2) + ' entregar cada paquete' + (sinTarifa ? '.' : ' y ML te paga ' + money_(t, 2) + ': ' + (t - c.costoPaq >= 0 ? 'ganas ' : 'pierdes ') + money_(Math.abs(t - c.costoPaq), 2) + ' por paquete.')
  });
  add({
    id: 'utilKm', seccion: 'Dinero', nombre: 'Pesos ganados por km', fmt: 'money2', valor: sinTarifa ? null : c.utilKm, prevVal: p.ingreso ? p.utilKm : null, mejorSi: 'up',
    estado: c.utilKm === null ? 'gris' : (c.utilKm <= 0 ? 'rojo' : tend(c.utilKm, p.ingreso ? p.utilKm : null, 'up')),
    que: 'Utilidad por cada kilómetro recorrido. Junta en un número qué tan densas son tus rutas y qué tan caro te sale moverte.',
    lectura: 'Por cada km ingresas ' + money_(c.ingKm, 2) + ' y gastas ' + money_(c.costKm, 2) + '. Sube este número con rutas más compactas (más paquetes por km).',
    faltan: 'Faltan km de salida y llegada en las rutas cerradas.'
  });
  add({
    id: 'equilibrio', seccion: 'Dinero', nombre: 'Punto de equilibrio', fmt: 'num', unidad: 'paq/día', valor: c.bePaqDia, prevVal: p.bePaqDia, mejorSi: 'down',
    keep: !sinTarifa && c.ent > 0 && c.mcu <= 0,
    estado: (sinTarifa || c.ent === 0) ? 'gris' : (c.mcu <= 0 ? 'rojo' : (c.paqDia >= c.bePaqDia * 1.2 ? 'verde' : (c.paqDia >= c.bePaqDia ? 'amarillo' : 'rojo'))),
    que: 'Paquetes que necesitas entregar al día (de los días trabajados) para cubrir sueldos, seguros y demás gastos fijos.',
    lectura: c.mcu <= 0 ? 'Tus gastos variables por paquete (' + money_(c.cvu, 2) + ') ya superan la tarifa: ningún volumen te da utilidad hasta bajarlos.' : 'Necesitas ' + fmtNum_(Math.ceil(c.bePaqDia || 0)) + ' paquetes al día para no perder; hoy promedias ' + fmtNum_(Math.round(c.paqDia || 0)) + '. Cada paquete arriba de eso te deja ' + money_(c.mcu, 2) + '.',
    faltan: sinTarifa ? 'Captura la tarifa por paquete en Configuración.' : undefined
  });
  add({
    id: 'nominaPaq', seccion: 'Dinero', nombre: 'Nómina por paquete', fmt: 'money2', valor: c.nominaPaq, prevVal: p.nominaPaq, mejorSi: 'down',
    estado: tend(c.nominaPaq, p.nominaPaq, 'down'),
    que: 'Sueldos e IMSS divididos entre paquetes entregados. Muestra si tu gente está bien aprovechada.',
    lectura: 'Pagas ' + money_(c.nominaPaq, 2) + ' de nómina por cada paquete entregado' + (t > 0 && c.nominaPaq ? ' (' + pct_(c.nominaPaq / t) + ' de la tarifa).' : '.'),
    faltan: 'Registra los sueldos en Gastos.'
  });
  add({
    id: 'conciliacion', seccion: 'Dinero', nombre: 'Pagos ML vs. calculado', fmt: 'money', valor: (c.pagado > 0 && !sinTarifa) ? c.pagado - c.ingreso : null, mejorSi: 'up',
    estado: (c.pagado > 0 && c.ingreso > 0 && (c.pagado - c.ingreso) < -0.05 * c.ingreso) ? 'amarillo' : 'gris',
    que: 'Diferencia entre lo que ML te depositó en el periodo y lo que el sistema calcula que debías cobrar. ML paga con desfase, así que revísalo por cortes.',
    lectura: 'Calculado: ' + money_(c.ingreso) + ' · Registrado como pagado: ' + money_(c.pagado) + '. Si la diferencia se mantiene en varios cortes, pide aclaración a ML.',
    faltan: 'Registra los pagos de ML en Más → Pagos ML.'
  });

  /* --- OPERACIÓN --- */
  add({
    id: 'tasa', seccion: 'Operación', brujula: true, nombre: 'Tasa de entrega', fmt: 'pct', valor: c.tasa, prevVal: p.tasa, mejorSi: 'up', meta: metaT,
    estado: c.tasa === null ? 'gris' : (c.tasa >= metaT ? 'verde' : (c.tasa >= metaT - 0.05 ? 'amarillo' : 'rojo')),
    que: 'De todos los paquetes que cargaste, cuántos se entregaron. Cada paquete no entregado es trabajo que hiciste y no cobraste.',
    lectura: 'De ' + fmtNum_(c.cargT) + ' paquetes cargados se entregaron ' + fmtNum_(c.entT) + '. Meta: ' + pct_(metaT) + '.' + (c.motivos[0] ? ' Motivo #1 de no entrega: "' + c.motivos[0].motivo + '".' : ''),
    faltan: 'Los choferes deben escanear la carga y cerrar ruta.'
  });
  add({
    id: 'paqVanDia', seccion: 'Operación', nombre: 'Paquetes por van por día', fmt: 'num', valor: c.paqVanDia, prevVal: p.paqVanDia, mejorSi: 'up',
    estado: tend(c.paqVanDia, p.paqVanDia, 'up'),
    que: 'Volumen promedio que entrega cada van en un día de trabajo. Es tu capacidad real por unidad.',
    lectura: 'Cada van entrega en promedio ' + fmtNum_(Math.round(c.paqVanDia || 0)) + ' paquetes por día trabajado.'
  });
  add({
    id: 'paqHora', seccion: 'Operación', nombre: 'Paquetes por hora', fmt: 'num1', valor: c.paqHora, prevVal: p.paqHora, mejorSi: 'up',
    estado: tend(c.paqHora, p.paqHora, 'up'),
    que: 'Entregas por hora de ruta (desde el checklist de salida hasta el cierre). Mide productividad del chofer y de la ruta.',
    lectura: 'Se entregan ' + (c.paqHora || 0).toFixed(1) + ' paquetes por hora en ' + (c.horas || 0).toFixed(0) + ' horas de ruta registradas.',
    faltan: 'Hace falta que los choferes hagan checklist al salir y cierren ruta al terminar.'
  });
  add({
    id: 'kmPaq', seccion: 'Operación', nombre: 'Km por paquete', fmt: 'num2', valor: c.kmPaq, prevVal: p.kmPaq, mejorSi: 'down',
    estado: tend(c.kmPaq, p.kmPaq, 'down'),
    que: 'Kilómetros que recorres por cada paquete entregado. Menos es mejor: indica qué tan densa es la ruta.',
    lectura: 'Recorres ' + (c.kmPaq || 0).toFixed(2) + ' km por paquete (' + fmtNum_(c.km) + ' km en total).',
    faltan: 'Faltan km de salida y llegada en las rutas cerradas.'
  });
  add({
    id: 'incid', seccion: 'Operación', nombre: 'Incidencias', fmt: 'pct', valor: c.incidRate, prevVal: p.incidRate, mejorSi: 'down', meta: 1 - metaT,
    estado: c.incidRate === null ? 'gris' : (c.incidRate <= (1 - metaT) ? 'verde' : (c.incidRate <= 2 * (1 - metaT) ? 'amarillo' : 'rojo')),
    que: 'Problemas reportados por los choferes (no estaba, dirección mal, dañado…) contra paquetes cargados.',
    lectura: fmtNum_(c.incid) + ' incidencias en el periodo.' + (c.motivos.length ? ' Principales: ' + c.motivos.slice(0, 3).map(function (m) { return m.motivo + ' (' + m.n + ')'; }).join(', ') + '.' : '')
  });

  /* --- FLOTA --- */
  add({
    id: 'utilizacion', seccion: 'Flota', nombre: 'Uso de la flota', fmt: 'pct', valor: c.utilizacion, prevVal: p.utilizacion, mejorSi: 'up', meta: metaU,
    estado: c.utilizacion === null ? 'gris' : (c.utilizacion >= metaU ? 'verde' : (c.utilizacion >= metaU - 0.15 ? 'amarillo' : 'rojo')),
    que: 'Porcentaje de días en que cada van salió a trabajar. Una van parada sigue pagando seguro, tenencia y depreciación.',
    lectura: 'Tus ' + c.vansActivas + ' vans trabajaron ' + c.vanDias + ' de ' + (c.vansActivas * c.dias) + ' días posibles. Meta: ' + pct_(metaU) + '.'
  });
  add({
    id: 'rend', seccion: 'Flota', nombre: 'Rendimiento de combustible', fmt: 'num1', unidad: 'km/l', valor: c.rend, prevVal: p.rend, mejorSi: 'up',
    estado: tend(c.rend, p.rend, 'up'),
    que: 'Kilómetros recorridos por litro cargado. Si baja de golpe: llantas bajas, falla mecánica, manejo agresivo o robo de combustible.',
    lectura: 'Promedio de ' + (c.rend || 0).toFixed(1) + ' km/l (' + fmtNum_(c.km) + ' km con ' + fmtNum_(Math.round(c.litros)) + ' litros). Compara por van en la tabla de abajo.',
    faltan: 'Los choferes deben registrar cada carga de gasolina con foto del ticket.'
  });
  add({
    id: 'combKm', seccion: 'Flota', nombre: 'Combustible por km', fmt: 'money2', valor: c.combKm, prevVal: p.combKm, mejorSi: 'down',
    estado: tend(c.combKm, p.combKm, 'down'),
    que: 'Pesos de gasolina por kilómetro recorrido.',
    lectura: 'Gastas ' + money_(c.combKm, 2) + ' de combustible por km.'
  });
  add({
    id: 'mantKm', seccion: 'Flota', nombre: 'Mantenimiento por km', fmt: 'money2', valor: c.mantKm, prevVal: p.mantKm, mejorSi: 'down',
    estado: tend(c.mantKm, p.mantKm, 'down'),
    que: 'Mantenimiento, llantas y reparaciones por kilómetro. Si sube mucho, revisa si conviene renovar una van.',
    lectura: 'Gastas ' + money_(c.mantKm, 2) + ' de mantenimiento por km recorrido.',
    faltan: 'Registra los servicios en Flota → Mantenimiento.'
  });
  add({
    id: 'checklist', seccion: 'Flota', nombre: 'Rutas con checklist', fmt: 'pct', valor: c.checkCumpl, prevVal: p.checkCumpl, mejorSi: 'up', meta: 1,
    estado: c.checkCumpl === null ? 'gris' : (c.checkCumpl >= 0.99 ? 'verde' : (c.checkCumpl >= 0.8 ? 'amarillo' : 'rojo')),
    que: 'Rutas cerradas que hicieron checklist de salida. Es tu evidencia de km y del estado de la van.',
    lectura: c.conCheck + ' de ' + c.cerradas + ' rutas hicieron checklist.'
  });
  return L;
}

function salud_(kpis) {
  const pts = { verde: 100, amarillo: 60, rojo: 15 };
  const v = kpis.filter(function (k) { return k.estado !== 'gris'; });
  if (!v.length) return { score: null, etiqueta: 'Sin datos aún', texto: 'Cuando cierres rutas y registres gastos aparecerá la calificación de la empresa.' };
  let tot = 0, peso = 0;
  v.forEach(function (k) { const w = k.brujula ? 2 : 1; tot += pts[k.estado] * w; peso += w; });
  const score = Math.round(tot / peso);
  const etiqueta = score >= 80 ? 'Sana' : (score >= 60 ? 'Estable, con áreas por mejorar' : (score >= 40 ? 'En riesgo' : 'Crítica'));
  const rojos = v.filter(function (k) { return k.estado === 'rojo'; }).map(function (k) { return k.nombre; });
  return { score: score, etiqueta: etiqueta, verdes: v.filter(function (k) { return k.estado === 'verde'; }).length, amarillos: v.filter(function (k) { return k.estado === 'amarillo'; }).length, rojos: rojos.length, texto: rojos.length ? 'Atiende primero: ' + rojos.slice(0, 3).join(', ') + '.' : 'Ningún indicador en rojo.' };
}

function plan_(c, p, cfg, alertasRojas) {
  const metaT = num_(cfg.Meta_tasa_entrega) || 0.95, metaM = num_(cfg.Meta_margen) || 0.2, metaU = num_(cfg.Meta_utilizacion) || 0.85;
  const t = c.tarifa;
  const m1 = [], m3 = [], m6 = [];

  /* ---------- 1 MES: control y fugas ---------- */
  if (!(t > 0)) m1.push({ p: 0, titulo: 'Captura la tarifa por paquete', detalle: 'Sin la tarifa de Mercado Libre no se pueden calcular ingresos, utilidad ni punto de equilibrio. Ve a Más → Configuración.' });
  if (c.cerradas === 0) m1.push({ p: 0, titulo: 'Arranca la captura diaria', detalle: 'Aún no hay rutas cerradas en este periodo. Cada chofer debe escanear la carga, hacer checklist al salir y cerrar ruta con km y entregados. De ahí salen todos los indicadores.' });
  if (alertasRojas > 0) m1.push({ p: 0, titulo: 'Regulariza ' + alertasRojas + ' alerta(s) en rojo', detalle: 'Hay documentos vencidos, servicios atrasados o fallas en checklist. Una van sin seguro vigente o con servicio vencido es el riesgo más caro que puedes tener.' });
  if (c.tasa !== null && c.tasa < metaT) {
    const top = c.motivos[0];
    m1.push({
      p: 1, titulo: 'Sube la tasa de entrega de ' + pct_(c.tasa) + ' a ' + pct_(metaT),
      detalle: 'Cada punto porcentual son ≈ ' + fmtNum_(Math.round(c.cargT * 0.01)) + ' paquetes más cobrados en un periodo como este' + (t > 0 ? ' (' + money_(c.cargT * 0.01 * t) + ')' : '') + '.' + (top ? ' El motivo #1 es "' + top.motivo + '" (' + top.n + ' casos): ' + (ACCION_MOTIVO[top.motivo] || '') : '')
    });
  }
  if (c.cerradas > 0 && c.checkCumpl !== null && c.checkCumpl < 0.99) m1.push({ p: 2, titulo: 'Checklist obligatorio en todas las salidas', detalle: (c.cerradas - c.conCheck) + ' de ' + c.cerradas + ' rutas salieron sin checklist. Sin él no tienes km confiables ni evidencia si aparece un golpe. Regla: sin checklist no sale la van.' });
  if (c.sinKm > 0) m1.push({ p: 2, titulo: 'Kilometraje completo en cada ruta', detalle: c.sinKm + ' rutas cerradas no tienen km válidos, así que los indicadores por km están incompletos.' });
  c.vansDet.forEach(function (v) {
    const pv = p.vansDet.filter(function (x) { return x.id === v.id; })[0];
    if (v.rend && pv && pv.rend && v.rend < pv.rend * 0.9) m1.push({ p: 1, titulo: 'Revisa el consumo de ' + v.nombre, detalle: 'Su rendimiento bajó de ' + pv.rend.toFixed(1) + ' a ' + v.rend.toFixed(1) + ' km/l. Revisa presión de llantas, filtro de aire y manejo, y compara los km del GPS contra los tickets.' });
  });
  if (c.pagado > 0 && c.ingreso > 0 && c.pendiente > 0.05 * c.ingreso) m1.push({ p: 2, titulo: 'Concilia pagos con Mercado Libre', detalle: 'El sistema calcula ' + money_(c.ingreso) + ' y tienes registrados ' + money_(c.pagado) + ' pagados. Cruza paquete por paquete en el siguiente corte y reclama lo que falte.' });

  /* ---------- 3 MESES: eficiencia ---------- */
  if (c.margen !== null && c.margen < metaM) {
    const top = c.gastosCat[0];
    const objetivo = metaM * c.ingreso;
    const gap = objetivo - c.utilidad;
    m3.push({
      p: 1, titulo: 'Lleva el margen de ' + pct_(c.margen) + ' a ' + pct_(metaM),
      detalle: (top ? 'Tu gasto más grande es ' + top.categoria + ' (' + pct_(top.share) + ' del total). ' + (ACCION_GASTO[top.categoria] || '') + ' ' : '') +
        'Para llegar a la meta te faltan ' + money_(gap) + ' de utilidad en un periodo como este: ≈ ' + fmtNum_(c.mcu > 0 ? Math.ceil(gap / c.mcu) : 0) + ' paquetes más con los mismos costos fijos, o recortar esa cantidad de gastos.'
    });
  }
  const zs = c.zonas.filter(function (z) { return z.rutas >= 2 && z.utilKm !== null; });
  if (zs.length >= 2 && t > 0) {
    const best = zs[0], worst = zs[zs.length - 1];
    if (worst.utilKm < best.utilKm * 0.7) m3.push({ p: 2, titulo: 'Mejora o cambia la zona "' + worst.nombre + '"', detalle: 'Deja ' + money_(worst.utilKm, 2) + ' por km contra ' + money_(best.utilKm, 2) + ' de "' + best.nombre + '". Pide a tu coordinador de ML más volumen en las zonas densas o reordena esa ruta para recorrer menos km.' });
  }
  const ch = c.choferes.filter(function (x) { return x.rutas >= 3 && x.paqHora; });
  if (ch.length >= 2) {
    const best = ch[0], worst = ch[ch.length - 1];
    if (worst.paqHora < best.paqHora * 0.8) m3.push({ p: 2, titulo: 'Cierra la brecha entre choferes', detalle: worst.nombre + ' entrega ' + worst.paqHora.toFixed(1) + ' paq/hora y ' + best.nombre + ' ' + best.paqHora.toFixed(1) + '. Pon a ' + worst.nombre + ' a acompañar un día a ' + best.nombre + ' y considera un bono por paquete entregado arriba de una meta diaria.' });
  }
  if (c.utilizacion !== null && c.utilizacion < metaU && c.vansActivas > 0) m3.push({ p: 1, titulo: 'Usa más tu flota (' + pct_(c.utilizacion) + ' hoy)', detalle: 'Cada día que una van no sale cuesta ≈ ' + money_(c.fijos / c.dias / c.vansActivas) + ' en gastos fijos sin generar ingreso. Pide rutas para esos días, cubre faltas con un chofer de reserva o acomoda los servicios en días de poco volumen.' });
  if (c.kmPaq && p.kmPaq && c.kmPaq > p.kmPaq * 1.1) m3.push({ p: 2, titulo: 'Rutas más densas', detalle: 'Los km por paquete subieron de ' + p.kmPaq.toFixed(2) + ' a ' + c.kmPaq.toFixed(2) + '. Revisa en el GPS los recorridos de las rutas con más km y si hay vueltas o regresos innecesarios.' });
  if (c.nominaPaq && t > 0 && c.nominaPaq > 0.45 * t) m3.push({ p: 2, titulo: 'Esquema de pago por productividad', detalle: 'La nómina se lleva ' + pct_(c.nominaPaq / t) + ' de cada paquete. Un esquema de base + bono por paquete alinea el sueldo con el ingreso.' });

  /* ---------- 6 MESES: crecimiento ---------- */
  const sano = c.margen !== null && c.margen >= metaM && c.tasa !== null && c.tasa >= metaT && c.utilizacion !== null && c.utilizacion >= metaU;
  if (sano && c.utilVanMes > 0) {
    const costoVan = num_(cfg.Costo_van_nueva);
    m6.push({
      p: 1, titulo: 'Crece: agrega una van más',
      detalle: 'Cada van te deja ≈ ' + money_(c.utilVanMes) + ' al mes. ' + (costoVan > 0 ? 'Una van de ' + money_(costoVan) + ' se pagaría en ≈ ' + (costoVan / c.utilVanMes).toFixed(1) + ' meses. ' : 'Captura en Configuración el costo de una van nueva para calcular en cuánto se paga. ') + 'Antes de comprar, confirma por escrito con ML las rutas adicionales.'
    });
  } else {
    const falta = [];
    if (c.margen === null || c.margen < metaM) falta.push('margen ' + (c.margen === null ? 'sin dato' : pct_(c.margen)) + ' → ' + pct_(metaM));
    if (c.tasa === null || c.tasa < metaT) falta.push('tasa de entrega ' + (c.tasa === null ? 'sin dato' : pct_(c.tasa)) + ' → ' + pct_(metaT));
    if (c.utilizacion === null || c.utilizacion < metaU) falta.push('uso de flota ' + (c.utilizacion === null ? 'sin dato' : pct_(c.utilizacion)) + ' → ' + pct_(metaU));
    m6.push({ p: 1, titulo: 'Antes de crecer, cumple metas 2 meses seguidos', detalle: 'Una 4ª van multiplica lo que ya pasa: si hoy hay fugas, las duplica. Te falta: ' + falta.join('; ') + '.' });
  }
  if (c.fijosMes > 0) m6.push({ p: 2, titulo: 'Fondo de reserva de 2 meses', detalle: 'Junta ≈ ' + money_(c.fijosMes * 2) + ' (2 meses de gastos fijos) para aguantar un siniestro, una van en taller o un retraso de pago sin frenar la operación.' });
  m6.push({ p: 3, titulo: 'No dependas de un solo cliente', detalle: 'Hoy todo tu ingreso viene de Mercado Libre. Con la operación medida, ofrece tu capacidad libre a otra paquetería o a negocios locales; tu costo por paquete y por km te dice tu precio mínimo para cotizar.' });

  const top3 = function (arr) { return arr.sort(function (a, b) { return a.p - b.p; }).slice(0, 3).map(function (x) { return { titulo: x.titulo, detalle: x.detalle }; }); };
  const nota = c.diasOp < 5 ? 'Con menos de 5 días trabajados en el periodo, estas recomendaciones son preliminares. Se afinan solas conforme se acumulan datos.' : '';
  return { m1: top3(m1), m3: top3(m3), m6: top3(m6), nota: nota };
}



/* ====================== CENTRO DE CONTROL: alertas operativas e insights ====================== */
function horaMty_() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Monterrey', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const m = p.match(/(\d{2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : 0;
}
/** Alertas del día en curso: rutas sin checklist, rutas sin cerrar, cierres que no cuadran,
 *  choferes sin señal y cargas de gasolina imposibles para el tanque. */
function operativas_(D, ubic, ahoraMin) {
  const hoy = today_(), out = [];
  const ahora = ahoraMin === undefined ? horaMty_() : ahoraMin;
  const checkIds = {}; D.checks.forEach(function (c) { checkIds[c.Ruta_ID] = true; });
  const ultima = {}; (ubic || []).forEach(function (u) { if (u.ultima) ultima[u.ruta_id] = u.ultima; });
  D.rutas.filter(function (r) { return r.Fecha === hoy && r.Estado !== 'Cancelada'; }).forEach(function (r) {
    const quien = (r.Zona || 'Ruta') + ' · ' + r.Chofer;
    const abierta = r.Estado !== 'Cerrada';
    if (abierta && !checkIds[r.ID] && ahora >= 10 * 60) out.push({ nivel: 'amarillo', texto: quien + ': salió sin checklist o no ha salido', donde: 'rutas' });
    if (abierta && ahora >= 21 * 60) out.push({ nivel: 'rojo', texto: quien + ': la ruta sigue abierta', donde: 'rutas' });
    if (!abierta) {
      const dif = num_(r.Cargados) - num_(r.Entregados) - num_(r.No_entregados);
      if (num_(r.Cargados) > 0 && dif !== 0) out.push({ nivel: 'rojo', texto: quien + ': ' + (dif > 0 ? 'faltan ' + dif + ' paquetes por explicar' : 'reportó ' + (-dif) + ' paquetes de más'), donde: 'rutas' });
    }
    if (r.Estado === 'En ruta' && ubic) {
      const u = ultima[r.ID];
      let sinSenal = null;
      if (u) sinSenal = (Date.now() - new Date(u.ts).getTime()) / 60000;
      else { const sal = minutos_(r.Hora_salida); if (isFinite(sal)) sinSenal = ahora - (sal % 1440); }
      if (sinSenal !== null && sinSenal > 30) out.push({ nivel: 'amarillo', texto: quien + ': sin ubicación hace ' + Math.round(sinSenal) + ' min', donde: 'mapa' });
    }
  });
  const d7 = addDays_(hoy, -6);
  const vans = {}; D.vans.forEach(function (v) { vans[v.ID] = v; });
  D.gastos.filter(function (g) { return g.Categoria === 'Combustible' && String(g.Fecha) >= d7 && num_(g.Litros) > 0; }).forEach(function (g) {
    const v = vans[g.Van_ID]; const cap = v ? num_(v.Capacidad_tanque) : 0; const nom = v ? v.Alias : 'Van';
    if (cap > 0 && num_(g.Litros) > cap * 1.05) out.push({ nivel: 'rojo', texto: nom + ': carga de ' + num_(g.Litros) + ' L el ' + g.Fecha + ' supera el tanque (' + cap + ' L)', donde: 'flota' });
    const precio = num_(g.Monto) / num_(g.Litros);
    if (precio > 0 && (precio < 15 || precio > 40)) out.push({ nivel: 'amarillo', texto: nom + ': ticket con precio raro ($' + precio.toFixed(2) + '/L) el ' + g.Fecha, donde: 'flota' });
  });
  return out;
}

/** "Lo que cambió": compara el último día trabajado contra el promedio de las 4 semanas previas. */
function insights_(D, cfg) {
  const fechas = D.rutas.filter(function (r) { return r.Estado === 'Cerrada'; }).map(function (r) { return String(r.Fecha).slice(0, 10); }).sort();
  if (!fechas.length) return { fecha: null, items: [] };
  const dia = fechas[fechas.length - 1];
  const a = metrics_(dia, dia, D, cfg);
  const b = metrics_(addDays_(dia, -28), addDays_(dia, -1), D, cfg);
  const items = [];
  const comp = function (nombre, va, vb, mejorSi, fmt, umbral) {
    if (va === null || vb === null || !isFinite(va) || !isFinite(vb) || vb === 0) return;
    const ch = (va - vb) / Math.abs(vb);
    if (Math.abs(ch) < (umbral || 0.1)) return;
    const bueno = (ch > 0) === (mejorSi === 'up');
    const var_ = ch > 2 ? (va / vb).toFixed(1) + ' veces el promedio' : (ch > 0 ? '+' : '') + Math.round(ch * 100) + '%';
    items.push({ tono: bueno ? 'bueno' : 'malo', peso: Math.abs(ch), texto: nombre + ': ' + fmt(va) + ' contra ' + fmt(vb) + ' de promedio (' + var_ + ')' });
  };
  const n0 = function (x) { return fmtNum_(x); }, n1 = function (x) { return x.toFixed(1); }, n2 = function (x) { return x.toFixed(2); };
  if (b.diasOp > 0) {
    comp('Paquetes entregados', a.ent, b.ent / b.diasOp, 'up', n0);
    comp('Tasa de entrega', a.tasa, b.tasa, 'up', pct_, 0.03);
    comp('Paquetes por hora', a.paqHora, b.paqHora, 'up', n1);
    comp('Km por paquete', a.kmPaq, b.kmPaq, 'down', n2);
    if (a.tarifa > 0) comp('Utilidad por van', a.utilVanDia, b.utilVanDia, 'up', function (x) { return money_(x); }, 0.15);
    comp('Combustible por km', a.combKm, b.combKm, 'down', function (x) { return money_(x, 2); }, 0.15);
  }
  const ch = a.choferes.filter(function (x) { return x.paqHora; });
  if (ch.length >= 2) {
    items.push({ tono: 'bueno', peso: 0.05, texto: 'Mejor chofer del día: ' + ch[0].nombre + ' (' + ch[0].paqHora.toFixed(1) + ' paq/hora)' });
    const w = ch[ch.length - 1];
    if (w.paqHora < ch[0].paqHora * 0.8) items.push({ tono: 'malo', peso: 0.05, texto: w.nombre + ' quedó ' + Math.round((1 - w.paqHora / ch[0].paqHora) * 100) + '% abajo del mejor en paquetes por hora' });
  }
  if (a.motivos.length) items.push({ tono: 'neutro', peso: 0.01, texto: 'Motivo #1 de no entrega: ' + a.motivos[0].motivo + ' (' + a.motivos[0].n + ')' });
  if (!b.diasOp) items.push({ tono: 'neutro', peso: 0, texto: 'Aún no hay 4 semanas de historial: las comparaciones aparecerán conforme se acumulen días.' });
  items.sort(function (x, y) { return y.peso - x.peso; });
  return { fecha: dia, items: items.slice(0, 6).map(function (x) { return { tono: x.tono, texto: x.texto }; }) };
}


/* ====================== DESEMPEÑO DE CHOFERES (calificación 0-100 y bono) ====================== */
const PESOS_DESEMPENO = { entrega: 30, productividad: 25, incidencias: 15, checklist: 15, cuadre: 10, combustible: 5 };
const NOMBRES_DESEMPENO = {
  entrega: 'Tasa de entrega', productividad: 'Paquetes por hora', incidencias: 'Incidencias',
  checklist: 'Checklist de salida', cuadre: 'Cierres que cuadran', combustible: 'Rendimiento de combustible',
};
const CONSEJO_DESEMPENO = {
  entrega: 'Revisa con él los paquetes no entregados: horario de llegada, llamadas al cliente antes de llegar y foto de fachada como evidencia.',
  productividad: 'Acompáñalo medio día o ponlo con el chofer más rápido; revisa el orden de su ruta y los tiempos muertos en el mapa.',
  incidencias: 'Sus incidencias están arriba del resto: revisa los motivos más repetidos y las fotos que sube.',
  checklist: 'Está saliendo sin checklist. Regla: sin checklist no sale la van; es tu evidencia de km y de golpes.',
  cuadre: 'Sus cierres no cuadran con lo cargado. Pídele que revise en la app de ML antes de cerrar.',
  combustible: 'Su consumo es peor que el del resto: revisa manejo, presión de llantas y compara km del GPS contra los tickets.',
};
const CONSEJO_CHOFER = {
  entrega: 'Llama al cliente antes de llegar y toma foto de la fachada cuando no te abran: así sube tu tasa de entrega.',
  productividad: 'Acomoda la carga en el orden de la ruta y evita tiempos muertos: más paquetes por hora.',
  incidencias: 'Revisa bien la dirección antes de salir y reporta con foto: menos incidencias.',
  checklist: 'Haz el checklist todos los días antes de salir: cuenta para tu calificación.',
  cuadre: 'Antes de cerrar, revisa en la app de ML que entregados + no entregados = cargados.',
  combustible: 'Maneja suave, apaga el motor en cada entrega y revisa la presión de llantas.',
};
const lin_ = function (x, malo, bueno) { // 0 en "malo", 100 en "bueno"; funciona en ambos sentidos
  if (x === null || x === undefined || !isFinite(x)) return null;
  return Math.max(0, Math.min(100, (x - malo) / (bueno - malo) * 100));
};

/** Estadísticas crudas por chofer en un periodo. */
function statsChoferes_(desde, hasta, D) {
  const d0 = dayNum_(desde), d1 = dayNum_(hasta);
  const enR = function (f) { const n = dayNum_(String(f || '').slice(0, 10)); return n >= d0 && n <= d1; };
  const check = {}; D.checks.forEach(function (c) { check[c.Ruta_ID] = true; });
  const S = {};
  const get = function (id, nombre) {
    if (!S[id]) S[id] = { id: id, nombre: nombre, rutas: 0, cargados: 0, entCarg: 0, entregados: 0, horas: 0, entH: 0, km: 0, conCheck: 0, cuadradas: 0, incidencias: 0, litros: 0 };
    return S[id];
  };
  D.rutas.filter(function (r) { return r.Estado === 'Cerrada' && enR(r.Fecha); }).forEach(function (r) {
    const s = get(r.Chofer_ID, r.Chofer);
    const c = num_(r.Cargados), e = num_(r.Entregados), n = num_(r.No_entregados);
    s.rutas++; s.entregados += e;
    if (c > 0) { s.cargados += c; s.entCarg += e; if (c === e + n) s.cuadradas++; } else s.cuadradas++;
    const h = horasEntre_(r.Hora_salida, r.Hora_cierre); if (h > 0 && h < 20) { s.horas += h; s.entH += e; }
    const k = kmRuta_(r); if (k !== null) s.km += k;
    if (check[r.ID]) s.conCheck++;
  });
  D.incid.filter(function (i) { return enR(i.Fecha); }).forEach(function (i) { if (S[i.Chofer_ID]) S[i.Chofer_ID].incidencias++; });
  D.gastos.filter(function (g) { return g.Categoria === 'Combustible' && enR(g.Fecha) && g.Chofer_ID; }).forEach(function (g) { if (S[g.Chofer_ID]) S[g.Chofer_ID].litros += num_(g.Litros); });
  return Object.keys(S).map(function (k) { return S[k]; });
}

/** Califica a un chofer contra la meta y contra el promedio de la flotilla. */
function calificar_(s, flota, cfg) {
  const metaT = num_(cfg.Meta_tasa_entrega) || 0.95;
  const tasa = div_(s.entCarg, s.cargados), ph = div_(s.entH, s.horas), kml = div_(s.km, s.litros);
  const comp = {
    entrega: lin_(tasa, metaT - 0.20, metaT),
    productividad: (ph !== null && flota.paqHora) ? lin_(ph / flota.paqHora, 0.6, 1.15) : null,
    incidencias: s.cargados > 0 ? lin_(s.incidencias / s.cargados, 0.10, 0) : null,
    checklist: s.rutas ? lin_(s.conCheck / s.rutas, 0.5, 1) : null,
    cuadre: s.rutas ? lin_(s.cuadradas / s.rutas, 0.5, 1) : null,
    combustible: (kml !== null && flota.kml) ? lin_(kml / flota.kml, 0.75, 1.05) : null,
  };
  let tot = 0, peso = 0;
  Object.keys(comp).forEach(function (k) { if (comp[k] !== null) { tot += comp[k] * PESOS_DESEMPENO[k]; peso += PESOS_DESEMPENO[k]; } });
  const score = peso ? Math.round(tot / peso) : null;
  const partes = Object.keys(comp).map(function (k) { return { id: k, nombre: NOMBRES_DESEMPENO[k], valor: comp[k] === null ? null : Math.round(comp[k]), peso: PESOS_DESEMPENO[k] }; });
  const debil = partes.filter(function (p) { return p.valor !== null && p.valor < 70; }).sort(function (a, b) { return a.valor * (100 - a.peso) - b.valor * (100 - b.peso); })[0];
  return {
    score: score, nivel: score === null ? 'Sin datos' : score >= 90 ? 'Excelente' : score >= 80 ? 'Bueno' : score >= 65 ? 'Regular' : 'Necesita atención',
    partes: partes, tasa: tasa, paqHora: ph, kml: kml, consejo: debil ? CONSEJO_DESEMPENO[debil.id] : null, consejoChofer: debil ? CONSEJO_CHOFER[debil.id] : null, foco: debil ? debil.nombre : null,
  };
}

/** Ranking de choferes con calificación, bono estimado y consejo. */
function desempeno_(desde, hasta, D, cfg) {
  const stats = statsChoferes_(desde, hasta, D);
  const T = stats.reduce(function (a, s) { a.entH += s.entH; a.horas += s.horas; a.km += s.km; a.litros += s.litros; return a; }, { entH: 0, horas: 0, km: 0, litros: 0 });
  const flota = { paqHora: div_(T.entH, T.horas), kml: div_(T.km, T.litros) };
  const bonoPaq = num_(cfg.Bono_por_paquete), bonoMin = num_(cfg.Bono_score_minimo) || 80, bonoFull = num_(cfg.Bono_score_completo) || 90;
  const lista = stats.map(function (s) {
    const c = calificar_(s, flota, cfg);
    const factor = c.score === null ? 0 : c.score >= bonoFull ? 1 : c.score >= bonoMin ? 0.5 : 0;
    return {
      id: s.id, nombre: s.nombre, rutas: s.rutas, entregados: s.entregados, incidencias: s.incidencias,
      score: c.score, nivel: c.nivel, partes: c.partes, tasa: c.tasa, paqHora: c.paqHora, kml: c.kml, consejo: c.consejo, foco: c.foco,
      bono: bonoPaq > 0 ? Math.round(s.entregados * bonoPaq * factor) : null, bonoFactor: factor,
    };
  }).sort(function (a, b) { return (b.score === null ? -1 : b.score) - (a.score === null ? -1 : a.score); });
  return { desde: desde, hasta: hasta, flota: flota, choferes: lista, bonoConfigurado: bonoPaq > 0, bonoMin: bonoMin, bonoFull: bonoFull, bonoPaq: bonoPaq };
}

function truthy_(v) { return v === true || /^(s[ií]|true|1|ok|yes)$/i.test(String(v || '').trim()); }
function num_(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : 0; }
function sum_(arr, k) { return arr.reduce(function (a, x) { return a + num_(x[k]); }, 0); }
function div_(a, b) { return b > 0 ? a / b : null; }
function dayNum_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return NaN;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}
function dateFromNum_(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function addDays_(s, n) { return dateFromNum_(dayNum_(s) + n); }
function minutos_(s) {
  const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  return m ? dayNum_(m[1]) * 1440 + (+m[2]) * 60 + (+m[3]) : NaN;
}
function horasEntre_(a, b) { const x = minutos_(a), y = minutos_(b); return (isFinite(x) && isFinite(y)) ? (y - x) / 60 : 0; }
function kmRuta_(r) { const ki = num_(r.Km_inicio), kf = num_(r.Km_fin); return (ki > 0 && kf > ki && kf - ki < 2000) ? kf - ki : null; }
function asignado_(g, d0, d1) {
  const monto = num_(g.Monto);
  if (!monto) return 0;
  const start = dayNum_(String(g.Fecha || '').slice(0, 10));
  if (!isFinite(start)) return 0;
  const meses = Math.max(1, Math.round(num_(g.Meses) || 1));
  if (meses === 1) return (start >= d0 && start <= d1) ? monto : 0;
  const span = Math.round(meses * 30.4167), end = start + span - 1;
  const overlap = Math.min(end, d1) - Math.max(start, d0) + 1;
  return overlap > 0 ? monto * overlap / span : 0;
}
function fmtNum_(n) { const s = Math.round(Math.abs(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (n < 0 ? '-' : '') + s; }
function money_(n, dec) {
  if (n === null || n === undefined || !isFinite(n)) return '—';
  const neg = n < 0; n = Math.abs(n);
  const parts = n.toFixed(dec || 0).split('.');
  const s = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '$' + s + (parts[1] ? '.' + parts[1] : '');
}
function pct_(n) { return (n === null || n === undefined || !isFinite(n)) ? '—' : (Math.round(n * 1000) / 10) + '%'; }

function today_() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p;
}
function err_(msg) { return new Error(msg); }
export const FK = { desempeno: desempeno_, calificar: calificar_, insights: insights_, operativas: operativas_, adminKpis: adminKpis_, metrics: metrics_, alertas: alertas_, alertasVan: alertasVan_, today: today_, addDays: addDays_, dayNum: dayNum_, num: num_, kmRuta: kmRuta_, truthy: truthy_ };
