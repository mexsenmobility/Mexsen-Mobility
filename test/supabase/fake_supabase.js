// Imitación local de Supabase: PostgREST real + auth/functions/storage falsos.
// Sirve también la app (web/) en :8788 apuntando a esta imitación.
const http = require('http'), fs = require('fs'), path = require('path');
const NM = '/tmp/fsb/node_modules/';
const { Pool } = require(NM + 'pg');
const jwt = require(NM + 'jsonwebtoken');
const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
const ANON = jwt.sign({ role: 'anon', iss: 'supabase' }, SECRET, { expiresIn: '10y' });
const db = new Pool({ host: '/tmp/pg', port: 5499, user: 'postgres', database: 't2' });
const PGRST = 3001, PORT = 54321, WEB = path.join(__dirname, '..', 'web');
const files = {};

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Content-Range, Content-Profile' };
const send = (res, status, body) => { res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const body = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const who = req => { try { return jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), SECRET); } catch (e) { return null; } };
const userObj = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });

async function hayAdmin() { return (await db.query("select count(*)::int n from public.perfiles where rol='admin'")).rows[0].n > 0; }
async function crear(d, rolF) {
  const usuario = String(d.usuario || '').trim().toLowerCase(), nombre = String(d.nombre || '').trim(), pin = String(d.pin || '');
  if (!nombre) throw new Error('Escribe el nombre');
  if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) throw new Error('Usuario: 3 a 20 letras minúsculas o números, sin espacios');
  if (!/^\d{6}$/.test(pin)) throw new Error('El PIN debe tener exactamente 6 números');
  if ((await db.query('select 1 from public.perfiles where usuario=$1', [usuario])).rowCount) throw new Error('Ese usuario ya existe');
  const u = (await db.query('insert into auth.users(email, pass) values ($1,$2) returning id', [usuario + '@flotilla.app', pin])).rows[0];
  await db.query('insert into public.perfiles(id,nombre,usuario,rol,telefono,licencia_vence,sueldo_semanal) values ($1,$2,$3,$4,$5,$6,$7)',
    [u.id, nombre, usuario, rolF || (d.rol === 'admin' ? 'admin' : 'chofer'), d.telefono || null, d.licencia_vence || null, d.sueldo_semanal || null]);
  return { id: u.id, usuario };
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/rest/v1/')) {
      const b = await body(req);
      const h = { ...req.headers }; delete h.host; delete h['content-length'];
      const p = http.request({ host: '127.0.0.1', port: PGRST, path: req.url.replace('/rest/v1', ''), method: req.method, headers: { ...h, 'content-length': b.length } }, pr => {
        const hh = {}; for (const k in pr.headers) if (!k.startsWith('access-control')) hh[k] = pr.headers[k]; res.writeHead(pr.statusCode, { ...hh, ...CORS }); pr.pipe(res);
      });
      p.on('error', e => send(res, 502, { message: e.message })); p.end(b); return;
    }
    if (url.pathname === '/auth/v1/token') {
      const d = JSON.parse((await body(req)).toString() || '{}');
      const r = await db.query('select id, email from auth.users where email=$1 and pass=$2', [d.email, d.password]);
      if (!r.rowCount) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      const u = r.rows[0];
      const at = jwt.sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email }, SECRET, { expiresIn: 3600 });
      return send(res, 200, { access_token: at, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + u.id, user: userObj(u.id, u.email) });
    }
    if (url.pathname === '/auth/v1/user') { const c = who(req); return c ? send(res, 200, userObj(c.sub, c.email)) : send(res, 401, { msg: 'invalid' }); }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    if (url.pathname === '/functions/v1/usuarios') {
      const { action, data = {} } = JSON.parse((await body(req)).toString() || '{}');
      try {
        if (action === 'estado') return send(res, 200, { hayAdmin: await hayAdmin() });
        if (action === 'bootstrap') { if (await hayAdmin()) return send(res, 403, { error: 'Ya existe un administrador.' }); return send(res, 200, await crear(data, 'admin')); }
        const c = who(req);
        const yo = c && (await db.query('select rol, activo from public.perfiles where id=$1', [c.sub])).rows[0];
        if (!yo || yo.rol !== 'admin' || !yo.activo) return send(res, 403, { error: 'No tienes permiso para esto' });
        if (action === 'crear') return send(res, 200, await crear(data));
        if (action === 'pin') { if (!/^\d{6}$/.test(String(data.pin))) return send(res, 400, { error: 'PIN' }); await db.query('update auth.users set pass=$1 where id=$2', [data.pin, data.id]); return send(res, 200, { ok: true }); }
        return send(res, 400, { error: 'Acción no válida' });
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/fotos')) {
      const c = who(req); const adm = c && (await db.query("select 1 from public.perfiles where id=$1 and rol='admin' and activo", [c.sub])).rowCount;
      const d = JSON.parse((await body(req)).toString() || '{}');
      if (!adm) return send(res, 200, (d.paths || []).map(p => ({ path: p, signedURL: null, error: 'not allowed' })));
      return send(res, 200, (d.paths || []).map(p => ({ path: p, signedURL: '/object/sign/fotos/' + p + '?token=t', error: null })));
    }
    if (url.pathname.startsWith('/storage/v1/object/fotos/')) {
      const p = decodeURIComponent(url.pathname.replace('/storage/v1/object/fotos/', ''));
      const c = who(req);
      if (!c || p.split('/')[0] !== c.sub) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
      files[p] = (await body(req)).length;
      return send(res, 200, { Key: 'fotos/' + p, Id: p });
    }
    send(res, 404, { message: 'no route ' + url.pathname });
  } catch (e) { send(res, 500, { message: e.message }); }
}).listen(PORT, () => console.log('fake supabase on', PORT));

http.createServer((req, res) => {
  let p = req.url.split('?')[0]; if (p === '/') p = '/index.html';
  if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(`window.FLOTILLA_CONFIG={url:'http://localhost:${PORT}',anonKey:'${ANON}'};`); }
  const f = path.join(WEB, p);
  if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
}).listen(8788, () => console.log('web on 8788'));
module.exports = { files };
