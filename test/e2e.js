// Prueba de punta a punta de la app Next.js contra la imitación local de Supabase
const fs = require('fs');
const { chromium, devices } = require('playwright');
const SHOTS = __dirname + '/shots'; fs.mkdirSync(SHOTS, { recursive: true });
const FOTO = '/tmp/fsb/ticket.jpg';
const BASE = 'http://localhost:8790';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], permissions: ['geolocation'], geolocation: { latitude: 25.5428, longitude: -103.4068 } });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
  const tab = (t) => page.click(`.tabs a:has-text("${t}")`);
  const closed = () => page.waitForSelector('.modal', { state: 'detached' });
  const toastTxt = async () => { await page.waitForSelector('#toast'); const t = await page.textContent('#toast'); await page.waitForSelector('#toast', { state: 'detached', timeout: 6000 }).catch(() => {}); return t; };
  const step = (m) => console.log('✔', m);
  const mas = async (item) => { await tab('Más'); await page.waitForSelector('.item:has-text("Configuración")'); await page.click(`.item:has-text("${item}")`); };
  const login = async (u, p) => { await page.waitForSelector('#lu'); await page.fill('#lu', u); await page.fill('#lp', p); await page.click('#lbtn'); };
  const salir = async () => { await page.click('header button:has-text("Salir")'); };

  await page.goto(BASE + '/');
  await page.waitForSelector('#bn'); await shot('01-setup'); step('pantalla de primer arranque');
  await page.fill('#bn', 'Santiago'); await page.fill('#bu', 'santiago'); await page.fill('#bp', '123456'); await page.click('#bbtn');
  await page.waitForSelector('.stat'); step('admin creado y dentro'); await shot('02-inicio');

  await mas('Configuración'); await page.waitForSelector('[data-k=Tarifa_por_paquete]');
  await page.fill('[data-k=Tarifa_por_paquete]', '18'); await page.click('button:has-text("Guardar")'); console.log('  config:', await toastTxt());

  await tab('Flota'); await page.click('text=+ Nueva van');
  await page.fill('#va', 'Van 1'); await page.fill('#vp', 'XYZ-001'); await page.fill('#vk', '25000'); await page.fill('#vse', '2026-10-20');
  await page.click('.modal button:has-text("Guardar")'); await closed(); await page.waitForSelector('h2:has-text("Van 1")'); step('van');

  await mas('Choferes y usuarios'); await page.click('text=+ Nuevo usuario');
  await page.fill('#un', 'Juan Pérez'); await page.fill('#uu', 'juan'); await page.fill('#up', '111111'); await page.fill('#ul', '2026-10-01');
  await page.click('.modal button:has-text("Guardar")'); await closed(); await page.waitForSelector('text=@juan'); step('chofer');

  await tab('Rutas'); await page.waitForSelector('text=+ Nueva ruta'); await page.click('text=+ Nueva ruta'); await page.fill('#rz', 'Centro');
  await page.click('.modal button:has-text("Guardar")'); await closed(); await page.waitForSelector('.item:has-text("Centro")'); step('ruta'); await shot('03-rutas');
  await salir();

  await login('juan', '111111');
  await page.waitForSelector('text=Escanear paquetes'); step('chofer dentro'); await shot('04-chofer');
  await page.click('text=Checklist de la van'); await page.fill('#ckm', '25010');
  for (const k of ['Llantas', 'Luces', 'Aceite', 'Golpes', 'Limpieza']) await page.click(`[data-k=${k}] button:has-text("OK")`);
  await page.setInputFiles('#cfoto', FOTO); await page.click('#ckbtn'); console.log('  checklist:', await toastTxt());
  await page.waitForSelector('text=✅ Checklist de la van');
  await page.waitForSelector('#gps:has-text("Ubicación activa")', { timeout: 10000 }); step('ubicación compartida'); await page.waitForTimeout(1500);
  await page.click('button:has-text("Escanear paquetes")'); await page.waitForSelector('#manual');
  for (const c of ['44111', '44222', '44222', '{"id":"44333","sender_id":1}', '00999']) { await page.fill('#manual', c); await page.click('#scanner button:has-text("OK")'); await page.waitForTimeout(450); }
  console.log('  contador escáner:', await page.textContent('#cnt'), '(esperado 4)'); await shot('05-scanner');
  await page.click('text=Listo ✓'); await page.waitForSelector('text=4 paquetes escaneados');
  await page.click('text=⚠️ Incidencia'); await page.click('.chip >> nth=0'); await page.fill('#icod', '44222'); await page.fill('#icom', 'Nadie abrió');
  await page.setInputFiles('#ifoto', FOTO); await page.click('#ibtn'); console.log('  incidencia:', await toastTxt());
  await page.click('text=⛽ Gasolina'); await page.fill('#gkm', '25040'); await page.fill('#glit', '35'); await page.fill('#gmon', '840');
  await page.setInputFiles('#gfoto', FOTO); await page.click('#gbtn'); console.log('  gasolina:', await toastTxt());
  await page.click('text=Cerrar ruta'); await page.fill('#cent', '3'); await page.fill('#cno', '1');
  console.log('  cuadre:', await page.textContent('#dif'));
  await page.fill('#ckmf', '25095'); await page.click('#cbtn'); console.log('  cierre:', await toastTxt());
  await page.waitForSelector('.pill:has-text("Cerrada")'); step('ruta cerrada'); await shot('06-cerrada');
  await tab('Mensajes'); await page.waitForSelector('#mtxt'); await page.fill('#mtxt', 'Ya terminé'); await page.click('button:has-text("Enviar")');
  await page.waitForSelector('.msg.me'); step('mensaje chofer');
  await salir();

  await login('santiago', '123456');
  await page.waitForSelector('.kpi'); await shot('07-admin-inicio');
  console.log('  lo que cambió:', (await page.$$eval('.insight', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')))).join(' | ') || '(vacío)');
  await tab('Mapa'); await page.waitForSelector('.item'); await page.waitForTimeout(1500);
  console.log('  mapa:', (await page.$$eval('.leaflet-marker-icon', (e) => e.map((x) => x.innerText))).join(', ') || 'SIN MARCADORES', '·', (await page.textContent('.item')).replace(/\s+/g, ' ').slice(0, 120));
  await shot('07b-mapa');
  // historial: 10 días anteriores para probar las comparaciones
  require('child_process').execSync(`psql -h /tmp/pg -p 5499 -U postgres -d t2 -q -c "insert into public.rutas (fecha, zona, chofer_id, van_id, estado, cargados, entregados, no_entregados, km_inicio, km_fin, hora_salida, hora_cierre) select (now() at time zone 'America/Monterrey')::date - g, 'Centro', r.chofer_id, r.van_id, 'Cerrada', 100, 92, 8, 20000+g*100, 20000+g*100+90, now() - (g||' days')::interval - interval '8 hours', now() - (g||' days')::interval from generate_series(1,10) g, (select chofer_id, van_id from public.rutas limit 1) r"`);
  await tab('Inicio'); await page.waitForSelector('.insight');
  console.log('  lo que cambió (con historial):', (await page.$$eval('.insight', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')))).join(' | '));
  await shot('07c-insights');
  console.log('  stats:', (await page.$$eval('.stat', (e) => e.map((x) => x.innerText.replace(/\n/g, ' ')))).join(' | '));
  console.log('  alertas:', (await page.$$eval('.alert', (e) => e.map((x) => x.innerText))).join(' | '));
  await tab('Rutas'); await page.click('.item:has-text("Centro")'); await page.waitForSelector('text=Paquetes escaneados');
  console.log('  detalle:', (await page.textContent('.modal .box')).replace(/\s+/g, ' ').slice(0, 220));
  await page.mouse.click(5, 5); await closed();
  await tab('Flota'); await page.click('text=+ Mantenimiento'); await page.fill('#mt', 'Servicio de aceite'); await page.fill('#mc', '1500');
  await page.click('.modal button:has-text("Guardar")'); await closed();
  await page.click('text=Historial'); await page.waitForSelector('.modal table'); step('historial van'); await page.mouse.click(5, 5); await closed();
  await tab('KPIs'); await page.waitForSelector('.plan'); await shot('08-kpis');
  console.log('  kpis:', (await page.$$eval('.kpi', (e) => e.length)), 'tarjetas; plan:', (await page.$$eval('.plan b', (e) => e.map((x) => x.innerText))).slice(0, 3).join(' / '));
  await mas('Mensajes con choferes'); await page.click('.item:has-text("Juan")'); await page.waitForSelector('.msg');
  await page.fill('#mtxt', 'Gracias'); await page.click('button:has-text("Enviar")'); await page.waitForSelector('.msg.me >> nth=0'); step('chat admin');
  await mas('Gastos'); await page.click('text=+ Registrar gasto'); await page.fill('#gm', '36000'); await page.selectOption('#gc', 'Seguro'); await page.fill('#gme', '12');
  await page.click('.modal button:has-text("Guardar")'); await closed(); console.log('  total gastos:', await page.textContent('.big'));
  await mas('Incidencias'); await page.waitForSelector('.item'); await page.click('[aria-label="Marcar como resuelta"]'); step('incidencia resuelta');
  await mas('Pagos de Mercado Libre'); await page.click('text=+ Registrar pago'); await page.fill('#pm', '54'); await page.click('.modal button:has-text("Guardar")'); await closed(); step('pago ML');
  await mas('Choferes y usuarios'); await page.click('.item:has-text("Juan")'); await page.fill('#up', '222222'); await page.selectOption('#ua', 'No');
  await page.click('.modal button:has-text("Guardar")'); await closed(); step('chofer desactivado');
  await salir();
  await login('juan', '222222'); await page.waitForTimeout(1500);
  console.log('  chofer desactivado sigue en login?', !!(await page.$('#lu')));
  console.log('Errores JS:', errors.length ? errors : 'ninguno');
  await browser.close();
})().catch((e) => { console.error('FALLÓ:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
