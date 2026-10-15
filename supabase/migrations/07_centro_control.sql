-- Fase A · Centro de control: ubicaciones en vivo de los choferes y capacidad de tanque por van.

alter table public.vans add column if not exists capacidad_tanque numeric(6,1);

create table if not exists public.ubicaciones (
  id bigserial primary key,
  ts timestamptz not null default now(),
  fecha date not null,
  chofer_id uuid not null references public.perfiles(id) on delete cascade,
  ruta_id uuid references public.rutas(id) on delete cascade,
  van_id uuid references public.vans(id) on delete set null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  precision_m real,
  velocidad_kmh real
);
create index if not exists ubicaciones_ruta_idx on public.ubicaciones(ruta_id, ts);
create index if not exists ubicaciones_fecha_idx on public.ubicaciones(fecha, chofer_id, ts desc);
create index if not exists ubicaciones_chofer_idx on public.ubicaciones(chofer_id);
create index if not exists ubicaciones_van_idx on public.ubicaciones(van_id);

alter table public.ubicaciones enable row level security;
create policy admin_todo on public.ubicaciones for all to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- El chofer reporta su posición solo mientras su ruta está abierta.
create or replace function public.chofer_ubicacion(p_ruta uuid, p_lat double precision, p_lng double precision,
  p_precision real default null, p_velocidad real default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rutas; ult timestamptz;
begin
  r := public._ruta_del_chofer(p_ruta);
  select max(ts) into ult from public.ubicaciones where ruta_id = r.id;
  if ult is not null and now() - ult < interval '45 seconds' then return false; end if;  -- evita saturar
  insert into public.ubicaciones (fecha, chofer_id, ruta_id, van_id, lat, lng, precision_m, velocidad_kmh)
  values (r.fecha, r.chofer_id, r.id, r.van_id, p_lat, p_lng, p_precision, p_velocidad);
  return true;
end $$;

-- Mapa del administrador: última posición y recorrido de cada ruta del día.
create or replace function public.admin_mapa(p_fecha date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._solo_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'ruta_id', r.id, 'zona', r.zona, 'estado', r.estado, 'cargados', r.cargados, 'entregados', r.entregados,
      'chofer', p.nombre, 'van', v.alias, 'placas', v.placas, 'gps_link', v.gps_link,
      'ultima', (select jsonb_build_object('lat', u.lat, 'lng', u.lng, 'ts', u.ts, 'vel', u.velocidad_kmh)
                 from public.ubicaciones u where u.ruta_id = r.id order by u.ts desc limit 1),
      'recorrido', coalesce((select jsonb_agg(jsonb_build_array(u.lat, u.lng) order by u.ts)
                 from public.ubicaciones u where u.ruta_id = r.id), '[]'::jsonb)
    ) order by r.creado)
    from public.rutas r join public.perfiles p on p.id = r.chofer_id join public.vans v on v.id = r.van_id
    where r.fecha = p_fecha and r.estado <> 'Cancelada'), '[]'::jsonb);
end $$;

revoke execute on function public.chofer_ubicacion(uuid,double precision,double precision,real,real), public.admin_mapa(date) from public, anon;
grant execute on function public.chofer_ubicacion(uuid,double precision,double precision,real,real), public.admin_mapa(date) to authenticated;
grant select, insert, update, delete on public.ubicaciones to authenticated;
grant usage, select on sequence public.ubicaciones_id_seq to authenticated;
revoke all on public.ubicaciones from anon;
