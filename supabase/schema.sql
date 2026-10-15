-- =====================================================================
-- FLOTILLA · Base de datos (Supabase / PostgreSQL)
-- Seguridad: Row Level Security en todas las tablas.
--   · Administrador: acceso completo.
--   · Chofer: NO lee tablas directamente (salvo su perfil y sus mensajes);
--     todo lo hace por funciones que validan que la ruta sea suya.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Utilidades ----------
create or replace function public.hoy() returns date
language sql stable set search_path = public as $$ select (now() at time zone 'America/Monterrey')::date $$;

-- ---------- Tablas ----------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,20}$'),
  rol text not null default 'chofer' check (rol in ('admin','chofer')),
  telefono text,
  licencia_vence date,
  sueldo_semanal numeric(12,2),
  activo boolean not null default true,
  creado timestamptz not null default now()
);

create table if not exists public.config (
  clave text primary key,
  valor text not null default '',
  descripcion text
);

create table if not exists public.vans (
  id uuid primary key default gen_random_uuid(),
  alias text not null,
  marca text, modelo text, anio int,
  placas text,
  km_actual numeric(10,1) not null default 0,
  proximo_servicio_km numeric(10,1),
  seguro_vence date, verificacion_vence date, tenencia_vence date,
  gps_link text,
  activa boolean not null default true,
  notas text,
  creado timestamptz not null default now()
);

create table if not exists public.rutas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  zona text,
  chofer_id uuid not null references public.perfiles(id),
  van_id uuid not null references public.vans(id),
  link_ruta text,
  estado text not null default 'Asignada' check (estado in ('Asignada','Cargando','En ruta','Cerrada','Cancelada')),
  cargados int not null default 0,
  entregados int, no_entregados int,
  km_inicio numeric(10,1), km_fin numeric(10,1),
  hora_salida timestamptz, hora_cierre timestamptz,
  notas text,
  creado timestamptz not null default now()
);
create index if not exists rutas_fecha_idx on public.rutas(fecha);
create index if not exists rutas_chofer_idx on public.rutas(chofer_id, fecha);

create table if not exists public.paquetes (
  id bigserial primary key,
  ts timestamptz not null default now(),
  fecha date not null,
  ruta_id uuid not null references public.rutas(id) on delete cascade,
  chofer_id uuid not null references public.perfiles(id),
  codigo text not null,
  texto text,
  unique (ruta_id, codigo)
);
create index if not exists paquetes_codigo_idx on public.paquetes(codigo, fecha);

create table if not exists public.incidencias (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  fecha date not null,
  ruta_id uuid references public.rutas(id) on delete set null,
  chofer_id uuid references public.perfiles(id),
  codigo text,
  motivo text not null,
  comentario text,
  foto text,
  lat double precision, lng double precision,
  resuelta boolean not null default false
);
create index if not exists incidencias_fecha_idx on public.incidencias(fecha);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  fecha date not null,
  ruta_id uuid references public.rutas(id) on delete set null,
  van_id uuid references public.vans(id),
  chofer_id uuid references public.perfiles(id),
  km numeric(10,1) not null,
  llantas text, luces text, aceite text, golpes text, limpieza text,
  fallas text,
  comentario text,
  foto text
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  categoria text not null,
  concepto text,
  monto numeric(12,2) not null check (monto > 0),
  meses int not null default 1 check (meses >= 1),
  van_id uuid references public.vans(id) on delete set null,
  chofer_id uuid references public.perfiles(id) on delete set null,
  ruta_id uuid references public.rutas(id) on delete set null,
  litros numeric(8,2), km numeric(10,1),
  foto text,
  registro text,
  ts timestamptz not null default now()
);
create index if not exists gastos_fecha_idx on public.gastos(fecha);

create table if not exists public.mantenimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  van_id uuid not null references public.vans(id) on delete cascade,
  tipo text not null,
  km numeric(10,1),
  costo numeric(12,2) default 0,
  taller text,
  proximo_km numeric(10,1),
  notas text,
  gasto_id uuid references public.gastos(id) on delete set null
);

create table if not exists public.pagos_ml (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  desde date, hasta date,
  paquetes int,
  monto numeric(12,2) not null check (monto > 0),
  referencia text,
  notas text
);

create table if not exists public.mensajes (
  id bigserial primary key,
  ts timestamptz not null default now(),
  de_id uuid not null references public.perfiles(id) on delete cascade,
  para_id uuid references public.perfiles(id) on delete cascade,  -- null = para el administrador
  texto text not null check (length(texto) between 1 and 1000),
  leido boolean not null default false
);
create index if not exists mensajes_para_idx on public.mensajes(para_id, leido);

-- ---------- Configuración inicial ----------
insert into public.config (clave, valor, descripcion) values
  ('Nombre_negocio', '', 'Nombre comercial de la flotilla'),
  ('Tarifa_por_paquete', '0', 'Lo que te paga Mercado Libre por paquete entregado, en MXN'),
  ('Costo_van_nueva', '0', 'Inversión por cada van adicional, para calcular en cuánto se paga'),
  ('Intervalo_servicio_km', '10000', 'Cada cuántos km toca servicio (ajústalo al manual de tus vans)'),
  ('Meta_tasa_entrega', '0.95', 'Meta de entregas efectivas (0.95 = 95%)'),
  ('Meta_margen', '0.20', 'Meta de margen operativo (0.20 = 20%)'),
  ('Meta_utilizacion', '0.85', 'Meta de uso de flota: % de días que trabaja cada van (0.85 = 85%)'),
  ('Dias_alerta_vencimiento', '30', 'Días de anticipación para avisarte de seguros, verificación, licencias'),
  ('GPS_link', '', 'Link de la plataforma de GPS de tus vans')
on conflict (clave) do nothing;

-- ---------- Roles ----------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and rol = 'admin' and activo)
$$;

create or replace function public.chofer_actual() returns public.perfiles
language plpgsql stable security definer set search_path = public as $$
declare p public.perfiles;
begin
  select * into p from public.perfiles where id = auth.uid();
  if p.id is null or not p.activo then raise exception 'Usuario desactivado o sin sesión' using errcode = '42501'; end if;
  return p;
end $$;

-- ---------- Row Level Security ----------
alter table public.perfiles enable row level security;
alter table public.config enable row level security;
alter table public.vans enable row level security;
alter table public.rutas enable row level security;
alter table public.paquetes enable row level security;
alter table public.incidencias enable row level security;
alter table public.checklists enable row level security;
alter table public.gastos enable row level security;
alter table public.mantenimientos enable row level security;
alter table public.pagos_ml enable row level security;
alter table public.mensajes enable row level security;

create policy admin_todo on public.config for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.vans for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.rutas for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.paquetes for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.incidencias for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.checklists for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.gastos for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.mantenimientos for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy admin_todo on public.pagos_ml for all to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

create policy perfiles_leer on public.perfiles for select to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()));
create policy perfiles_admin_insertar on public.perfiles for insert to authenticated with check ((select public.es_admin()));
create policy perfiles_admin_editar on public.perfiles for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy perfiles_admin_borrar on public.perfiles for delete to authenticated using ((select public.es_admin()));

create policy mensajes_leer on public.mensajes for select to authenticated
  using ((select public.es_admin())
         or ((de_id = (select auth.uid()) or para_id = (select auth.uid()))
             and exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo)));
create policy mensajes_admin_insertar on public.mensajes for insert to authenticated with check ((select public.es_admin()));
create policy mensajes_admin_editar on public.mensajes for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));
create policy mensajes_admin_borrar on public.mensajes for delete to authenticated using ((select public.es_admin()));

-- El admin no puede quitarse a sí mismo el rol ni desactivarse
create or replace function public.proteger_admin() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.id = auth.uid() and (new.rol <> 'admin' or not new.activo) then
    raise exception 'No puedes desactivarte ni quitarte el rol de administrador';
  end if;
  if new.usuario <> old.usuario then raise exception 'El usuario no se puede cambiar'; end if;
  return new;
end $$;
create trigger proteger_admin before update on public.perfiles for each row execute function public.proteger_admin();

-- =====================================================================
-- FUNCIONES DEL CHOFER (única puerta de entrada para el chofer)
-- =====================================================================
create or replace function public.parse_codigo(t text) returns text
language plpgsql immutable set search_path = public as $$
declare j jsonb;
begin
  t := btrim(coalesce(t, ''));
  if t = '' then return ''; end if;
  if left(t, 1) = '{' then
    begin
      j := t::jsonb;
      if j ? 'id' then return j->>'id'; end if;
      if j ? 'shipment_id' then return j->>'shipment_id'; end if;
    exception when others then null;
    end;
  end if;
  return left(regexp_replace(t, '\s+', '', 'g'), 80);
end $$;

create or replace function public._ruta_del_chofer(p_ruta uuid, p_abierta boolean default true) returns public.rutas
language plpgsql security definer set search_path = public as $$
declare me public.perfiles; r public.rutas;
begin
  me := public.chofer_actual();
  select * into r from public.rutas where id = p_ruta for update;
  if r.id is null or r.chofer_id <> me.id then raise exception 'Esa ruta no está asignada a ti'; end if;
  if r.estado = 'Cancelada' then raise exception 'Esa ruta fue cancelada'; end if;
  if p_abierta and r.estado = 'Cerrada' then raise exception 'La ruta ya está cerrada'; end if;
  return r;
end $$;

create or replace function public.chofer_home() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.perfiles; r public.rutas; v public.vans; out jsonb;
begin
  me := public.chofer_actual();
  select * into r from public.rutas
   where chofer_id = me.id and fecha = public.hoy() and estado <> 'Cancelada'
   order by (estado = 'Cerrada'), creado desc limit 1;
  out := jsonb_build_object(
    'user', jsonb_build_object('id', me.id, 'nombre', me.nombre),
    'motivos', jsonb_build_array('No estaba / no atendió','Rechazó / no recibió','Dirección incorrecta','Zona insegura / sin acceso','Paquete dañado','Otro'),
    'noLeidos', (select count(*) from public.mensajes where para_id = me.id and not leido),
    'ruta', null, 'van', null, 'ultimos', '[]'::jsonb, 'checklist', false);
  if r.id is not null then
    select * into v from public.vans where id = r.van_id;
    out := out || jsonb_build_object(
      'ruta', jsonb_build_object('id', r.id, 'fecha', r.fecha, 'zona', r.zona, 'link_ruta', r.link_ruta, 'estado', r.estado,
              'cargados', r.cargados, 'entregados', r.entregados, 'no_entregados', r.no_entregados, 'km_inicio', r.km_inicio, 'hora_cierre', r.hora_cierre),
      'van', jsonb_build_object('alias', v.alias, 'placas', v.placas, 'km_actual', v.km_actual),
      'ultimos', coalesce((select jsonb_agg(codigo) from (select codigo from public.paquetes where ruta_id = r.id order by id desc limit 20) x), '[]'::jsonb),
      'checklist', exists (select 1 from public.checklists where ruta_id = r.id));
  end if;
  return out;
end $$;

create or replace function public.chofer_scan(p_ruta uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rutas; c text; n int; otra boolean;
begin
  r := public._ruta_del_chofer(p_ruta);
  c := public.parse_codigo(p_texto);
  if c = '' then raise exception 'Código vacío'; end if;
  insert into public.paquetes (fecha, ruta_id, chofer_id, codigo, texto)
  values (r.fecha, r.id, r.chofer_id, c, left(p_texto, 300))
  on conflict (ruta_id, codigo) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('duplicado', true, 'codigo', c, 'cargados', r.cargados); end if;
  otra := exists (select 1 from public.paquetes where codigo = c and fecha = r.fecha and ruta_id <> r.id);
  update public.rutas set cargados = cargados + 1, estado = case when estado = 'Asignada' then 'Cargando' else estado end
   where id = r.id returning cargados into n;
  return jsonb_build_object('duplicado', false, 'codigo', c, 'cargados', n, 'otraRuta', otra);
end $$;

create or replace function public.chofer_checklist(p_ruta uuid, p_km numeric, p_items jsonb, p_comentario text default null, p_foto text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rutas; v public.vans; k text; fallas text[] := '{}';
begin
  r := public._ruta_del_chofer(p_ruta);
  if p_km is null or p_km <= 0 then raise exception 'Captura el kilometraje del tablero'; end if;
  select * into v from public.vans where id = r.van_id for update;
  if v.km_actual > 0 and p_km < v.km_actual - 5 then
    raise exception 'El km es menor al último registrado (%). Revísalo.', v.km_actual;
  end if;
  foreach k in array array['llantas','luces','aceite','golpes','limpieza'] loop
    if coalesce(p_items->>k, '') not in ('OK','Falla') then raise exception 'Marca OK o Falla en cada punto'; end if;
    if p_items->>k = 'Falla' then fallas := fallas || initcap(k); end if;
  end loop;
  insert into public.checklists (fecha, ruta_id, van_id, chofer_id, km, llantas, luces, aceite, golpes, limpieza, fallas, comentario, foto)
  values (public.hoy(), r.id, r.van_id, r.chofer_id, p_km, p_items->>'llantas', p_items->>'luces', p_items->>'aceite', p_items->>'golpes', p_items->>'limpieza',
          nullif(array_to_string(fallas, ', '), ''), left(p_comentario, 500), p_foto);
  update public.rutas set km_inicio = p_km, hora_salida = now(),
         estado = case when estado in ('Asignada','Cargando') then 'En ruta' else estado end where id = r.id;
  update public.vans set km_actual = greatest(km_actual, p_km) where id = r.van_id;
  return jsonb_build_object('fallas', to_jsonb(fallas));
end $$;

create or replace function public.chofer_incidencia(p_ruta uuid, p_motivo text, p_codigo text default null, p_comentario text default null,
  p_foto text default null, p_lat double precision default null, p_lng double precision default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rutas;
begin
  r := public._ruta_del_chofer(p_ruta, false);
  if p_motivo not in ('No estaba / no atendió','Rechazó / no recibió','Dirección incorrecta','Zona insegura / sin acceso','Paquete dañado','Otro') then
    raise exception 'Elige el motivo';
  end if;
  insert into public.incidencias (fecha, ruta_id, chofer_id, codigo, motivo, comentario, foto, lat, lng)
  values (r.fecha, r.id, r.chofer_id, nullif(public.parse_codigo(p_codigo), ''), p_motivo, left(p_comentario, 500), p_foto, p_lat, p_lng);
  return true;
end $$;

create or replace function public.chofer_gasolina(p_ruta uuid, p_km numeric, p_litros numeric, p_monto numeric, p_foto text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rutas; me public.perfiles;
begin
  r := public._ruta_del_chofer(p_ruta, false);
  me := public.chofer_actual();
  if coalesce(p_km,0) <= 0 or coalesce(p_litros,0) <= 0 or coalesce(p_monto,0) <= 0 then raise exception 'Captura km, litros y monto'; end if;
  if coalesce(p_foto, '') = '' then raise exception 'Toma foto del ticket'; end if;
  insert into public.gastos (fecha, categoria, concepto, monto, meses, van_id, chofer_id, ruta_id, litros, km, foto, registro)
  values (public.hoy(), 'Combustible', 'Carga de combustible', p_monto, 1, r.van_id, me.id, r.id, p_litros, p_km, p_foto, me.nombre);
  update public.vans set km_actual = greatest(km_actual, p_km) where id = r.van_id;
  return true;
end $$;

create or replace function public.chofer_cerrar(p_ruta uuid, p_km_fin numeric, p_entregados int, p_no_entregados int, p_notas text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.rutas;
begin
  r := public._ruta_del_chofer(p_ruta);
  if coalesce(p_km_fin, 0) <= 0 then raise exception 'Captura el km final'; end if;
  if r.km_inicio is not null and p_km_fin < r.km_inicio then raise exception 'El km final no puede ser menor al de salida (%)', r.km_inicio; end if;
  if coalesce(p_entregados, -1) < 0 or coalesce(p_no_entregados, -1) < 0 then raise exception 'Revisa las cantidades'; end if;
  update public.rutas set km_fin = p_km_fin, entregados = p_entregados, no_entregados = p_no_entregados, hora_cierre = now(), estado = 'Cerrada',
         notas = case when coalesce(p_notas,'') = '' then notas else concat_ws(' | ', notas, left(p_notas, 300)) end
   where id = r.id;
  update public.vans set km_actual = greatest(km_actual, p_km_fin) where id = r.van_id;
  return jsonb_build_object('cargados', r.cargados, 'entregados', p_entregados, 'noEntregados', p_no_entregados,
    'km', case when r.km_inicio is not null then p_km_fin - r.km_inicio end,
    'diferencia', r.cargados - p_entregados - p_no_entregados);
end $$;

create or replace function public.chofer_enviar(p_texto text) returns boolean
language plpgsql security definer set search_path = public as $$
declare me public.perfiles;
begin
  me := public.chofer_actual();
  if btrim(coalesce(p_texto,'')) = '' then raise exception 'Mensaje vacío'; end if;
  insert into public.mensajes (de_id, para_id, texto) values (me.id, null, left(btrim(p_texto), 1000));
  return true;
end $$;

create or replace function public.leer_mensajes(p_con uuid default null) returns setof public.mensajes
language plpgsql security definer set search_path = public as $$
declare me public.perfiles;
begin
  me := public.chofer_actual();
  if me.rol = 'admin' then
    if p_con is null then raise exception 'Falta el chofer'; end if;
    update public.mensajes set leido = true where de_id = p_con and para_id is null and not leido;
    return query select * from (select * from public.mensajes where de_id = p_con or para_id = p_con order by id desc limit 100) x order by id;
  else
    update public.mensajes set leido = true where para_id = me.id and not leido;
    return query select * from (select * from public.mensajes where de_id = me.id or para_id = me.id order by id desc limit 100) x order by id;
  end if;
end $$;

-- =====================================================================
-- FUNCIONES DEL ADMINISTRADOR (operaciones de varios pasos)
-- =====================================================================
create or replace function public._solo_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin if not public.es_admin() then raise exception 'No tienes permiso para esto' using errcode = '42501'; end if; end $$;

create or replace function public.admin_mantenimiento(p_van uuid, p_tipo text, p_fecha date, p_km numeric, p_costo numeric,
  p_proximo numeric default null, p_taller text default null, p_notas text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare v public.vans; intervalo numeric; prox numeric; cat text; g uuid; km numeric;
begin
  perform public._solo_admin();
  select * into v from public.vans where id = p_van for update;
  if v.id is null then raise exception 'Elige la van'; end if;
  if coalesce(btrim(p_tipo),'') = '' then raise exception 'Escribe el tipo de mantenimiento'; end if;
  km := coalesce(nullif(p_km,0), v.km_actual);
  select coalesce(nullif(valor,'')::numeric, 10000) into intervalo from public.config where clave = 'Intervalo_servicio_km';
  prox := coalesce(nullif(p_proximo,0), case when p_tipo ~* '(servicio|afinaci|aceite)' then km + coalesce(intervalo,10000) end);
  if coalesce(p_costo,0) > 0 then
    cat := case when p_tipo ~* 'llanta' then 'Llantas' when p_tipo ~* '(repara|golpe|hojalat|choque)' then 'Reparaciones' else 'Mantenimiento' end;
    insert into public.gastos (fecha, categoria, concepto, monto, meses, van_id, km, registro)
    values (coalesce(p_fecha, public.hoy()), cat, p_tipo || ' · ' || v.alias, p_costo, 1, v.id, km, 'Admin') returning id into g;
  end if;
  insert into public.mantenimientos (fecha, van_id, tipo, km, costo, taller, proximo_km, notas, gasto_id)
  values (coalesce(p_fecha, public.hoy()), v.id, p_tipo, km, coalesce(p_costo,0), p_taller, prox, p_notas, g);
  update public.vans set km_actual = greatest(km_actual, km), proximo_servicio_km = coalesce(prox, proximo_servicio_km) where id = v.id;
  return true;
end $$;

create or replace function public.admin_duplicar_rutas(p_desde date, p_a date) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._solo_admin();
  insert into public.rutas (fecha, zona, chofer_id, van_id, link_ruta)
  select p_a, r.zona, r.chofer_id, r.van_id, r.link_ruta from public.rutas r
   where r.fecha = p_desde and r.estado <> 'Cancelada'
     and not exists (select 1 from public.rutas x where x.fecha = p_a and x.estado <> 'Cancelada'
                     and x.chofer_id = r.chofer_id and x.van_id = r.van_id and coalesce(x.zona,'') = coalesce(r.zona,''));
  get diagnostics n = row_count;
  return n;
end $$;

-- Conversaciones del admin: último mensaje y no leídos por chofer
create or replace function public.admin_conversaciones() returns table (id uuid, nombre text, activo boolean, ultimo_texto text, ultimo_ts timestamptz, no_leidos bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform public._solo_admin();
  return query
  select p.id, p.nombre, p.activo,
    (select m.texto from public.mensajes m where m.de_id = p.id or m.para_id = p.id order by m.id desc limit 1),
    (select m.ts from public.mensajes m where m.de_id = p.id or m.para_id = p.id order by m.id desc limit 1),
    (select count(*) from public.mensajes m where m.de_id = p.id and m.para_id is null and not m.leido)
  from public.perfiles p where p.rol = 'chofer'
  order by 5 desc nulls last, p.nombre;
end $$;

-- ---------- Permisos de ejecución ----------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.hoy(), public.es_admin(), public.parse_codigo(text) to authenticated;
grant execute on function public.chofer_home(), public.chofer_scan(uuid,text),
  public.chofer_checklist(uuid,numeric,jsonb,text,text), public.chofer_incidencia(uuid,text,text,text,text,double precision,double precision),
  public.chofer_gasolina(uuid,numeric,numeric,numeric,text), public.chofer_cerrar(uuid,numeric,int,int,text),
  public.chofer_enviar(text), public.leer_mensajes(uuid),
  public.admin_mantenimiento(uuid,text,date,numeric,numeric,numeric,text,text), public.admin_duplicar_rutas(date,date),
  public.admin_conversaciones() to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke execute on function public.chofer_actual(), public._ruta_del_chofer(uuid,boolean), public._solo_admin(), public.proteger_admin() from authenticated;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
