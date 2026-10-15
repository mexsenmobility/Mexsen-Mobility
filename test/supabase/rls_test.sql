\set ON_ERROR_STOP 0
\pset pager off
-- Usuarios
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','santiago@flotilla.app'),
 ('00000000-0000-0000-0000-00000000000b','juan@flotilla.app'),
 ('00000000-0000-0000-0000-00000000000c','pedro@flotilla.app');
insert into public.perfiles (id, nombre, usuario, rol) values
 ('00000000-0000-0000-0000-00000000000a','Santiago','santiago','admin'),
 ('00000000-0000-0000-0000-00000000000b','Juan','juan','chofer'),
 ('00000000-0000-0000-0000-00000000000c','Pedro','pedro','chofer');
insert into public.vans (id, alias, placas, km_actual) values ('10000000-0000-0000-0000-000000000001','Van 1','ABC-1',20000);
insert into public.rutas (id, fecha, zona, chofer_id, van_id) values
 ('20000000-0000-0000-0000-000000000001', public.hoy(), 'Centro','00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002', public.hoy(), 'Oriente','00000000-0000-0000-0000-00000000000c','10000000-0000-0000-0000-000000000001');
insert into public.gastos (fecha, categoria, monto) values (public.hoy(), 'Seguro', 30000);

\echo '===== CHOFER JUAN ====='
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select 'gastos visibles (debe 0)' t, count(*) from public.gastos;
select 'vans visibles (debe 0)' t, count(*) from public.vans;
select 'rutas visibles (debe 0)' t, count(*) from public.rutas;
select 'perfiles visibles (debe 1)' t, count(*) from public.perfiles;
select 'config visible (debe 0)' t, count(*) from public.config;
\echo '-- intento de insertar gasto (debe fallar)'
insert into public.gastos (fecha, categoria, monto) values (public.hoy(), 'Otros', 1);
\echo '-- intento de volverse admin (debe actualizar 0 filas)'
update public.perfiles set rol='admin' where id = auth.uid();
select public.chofer_home()->'ruta'->>'zona' as zona_home;
select public.chofer_scan('20000000-0000-0000-0000-000000000001', '{"id":"44123","sender_id":9}');
select public.chofer_scan('20000000-0000-0000-0000-000000000001', '44123');
select public.chofer_scan('20000000-0000-0000-0000-000000000001', '00777');
\echo '-- escanear en ruta ajena (debe fallar)'
select public.chofer_scan('20000000-0000-0000-0000-000000000002', '555');
\echo '-- checklist con km bajo (debe fallar)'
select public.chofer_checklist('20000000-0000-0000-0000-000000000001', 100, '{"llantas":"OK","luces":"OK","aceite":"OK","golpes":"OK","limpieza":"OK"}');
\echo '-- checklist incompleto (debe fallar)'
select public.chofer_checklist('20000000-0000-0000-0000-000000000001', 20010, '{"llantas":"OK"}');
select public.chofer_checklist('20000000-0000-0000-0000-000000000001', 20010, '{"llantas":"Falla","luces":"OK","aceite":"OK","golpes":"OK","limpieza":"OK"}', 'rayón', 'b/x.jpg');
select public.chofer_incidencia('20000000-0000-0000-0000-000000000001', 'Dirección incorrecta', '44123', 'no existe');
\echo '-- gasolina sin foto (debe fallar)'
select public.chofer_gasolina('20000000-0000-0000-0000-000000000001', 20050, 40, 950, '');
select public.chofer_gasolina('20000000-0000-0000-0000-000000000001', 20050, 40, 950, 'b/t.jpg');
select public.chofer_enviar('Ya salí');
select count(*) as mis_mensajes from public.mensajes;
\echo '-- llamar función de admin (debe fallar)'
select public.admin_duplicar_rutas(public.hoy(), public.hoy()+1);
select public.chofer_cerrar('20000000-0000-0000-0000-000000000001', 20120, 1, 0, 'todo bien');
\echo '-- escanear con ruta cerrada (debe fallar)'
select public.chofer_scan('20000000-0000-0000-0000-000000000001', '999');
select public.chofer_home()->'ruta'->>'estado' as estado_tras_cierre;

\echo '===== ADMIN ====='
reset role; set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select 'gastos (debe 2: seguro + gasolina)' t, count(*) from public.gastos;
select id, cargados, entregados, km_inicio, km_fin, estado from public.rutas where zona='Centro';
select codigo from public.paquetes;
select km_actual from public.vans;
select fallas, comentario from public.checklists;
select * from public.admin_conversaciones();
select texto from public.leer_mensajes('00000000-0000-0000-0000-00000000000b');
insert into public.mensajes (de_id, para_id, texto) values (auth.uid(), '00000000-0000-0000-0000-00000000000b', 'Va');
select public.admin_mantenimiento('10000000-0000-0000-0000-000000000001', 'Servicio de aceite', public.hoy(), null, 1800);
select categoria, monto from public.gastos order by ts;
select proximo_servicio_km from public.vans;
select public.admin_duplicar_rutas(public.hoy(), public.hoy()+1) as duplicadas;
\echo '-- admin intenta desactivarse (debe fallar)'
update public.perfiles set activo = false where id = auth.uid();
update public.perfiles set activo = false where usuario = 'juan';

\echo '===== JUAN DESACTIVADO ====='
reset role; set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.chofer_home();
select count(*) as mensajes_tras_desactivar from public.mensajes;

\echo '===== ANONIMO ====='
reset role; set role anon;
set request.jwt.claim.sub = '';
select count(*) from public.config;
select public.chofer_home();
