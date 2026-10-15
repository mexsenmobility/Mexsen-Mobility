-- Fase B · Desempeño de choferes: configuración del bono y estadísticas propias para la app del chofer.

insert into public.config (clave, valor, descripcion) values
  ('Bono_por_paquete', '0', 'Bono por paquete entregado para choferes con buena calificación (0 = sin bono)'),
  ('Bono_score_minimo', '80', 'Calificación mínima para cobrar medio bono'),
  ('Bono_score_completo', '90', 'Calificación para cobrar el bono completo')
on conflict (clave) do nothing;

-- Estadísticas del chofer que llama (y promedios de la flotilla) para calcular su calificación.
create or replace function public.chofer_desempeno(p_desde date, p_hasta date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.perfiles; s jsonb; f jsonb;
begin
  me := public.chofer_actual();
  with r as (
    select r.*,
      extract(epoch from (r.hora_cierre - r.hora_salida)) / 3600.0 as h,
      case when r.km_inicio > 0 and r.km_fin > r.km_inicio and r.km_fin - r.km_inicio < 2000 then r.km_fin - r.km_inicio end as km,
      exists (select 1 from public.checklists c where c.ruta_id = r.id) as con_check
    from public.rutas r
    where r.estado = 'Cerrada' and r.fecha between p_desde and p_hasta
  )
  select
    jsonb_build_object(
      'id', me.id, 'nombre', me.nombre,
      'rutas', count(*) filter (where chofer_id = me.id),
      'cargados', coalesce(sum(cargados) filter (where chofer_id = me.id and cargados > 0), 0),
      'entCarg', coalesce(sum(entregados) filter (where chofer_id = me.id and cargados > 0), 0),
      'entregados', coalesce(sum(entregados) filter (where chofer_id = me.id), 0),
      'horas', coalesce(sum(h) filter (where chofer_id = me.id and h > 0 and h < 20), 0),
      'entH', coalesce(sum(entregados) filter (where chofer_id = me.id and h > 0 and h < 20), 0),
      'km', coalesce(sum(km) filter (where chofer_id = me.id), 0),
      'conCheck', count(*) filter (where chofer_id = me.id and con_check),
      'cuadradas', count(*) filter (where chofer_id = me.id and (cargados = 0 or cargados = coalesce(entregados,0) + coalesce(no_entregados,0)))
    ),
    jsonb_build_object(
      'entH', coalesce(sum(entregados) filter (where h > 0 and h < 20), 0),
      'horas', coalesce(sum(h) filter (where h > 0 and h < 20), 0),
      'km', coalesce(sum(km), 0)
    )
  into s, f from r;
  s := s || jsonb_build_object(
    'incidencias', (select count(*) from public.incidencias i where i.chofer_id = me.id and i.fecha between p_desde and p_hasta),
    'litros', (select coalesce(sum(litros), 0) from public.gastos g where g.chofer_id = me.id and g.categoria = 'Combustible' and g.fecha between p_desde and p_hasta));
  f := f || jsonb_build_object('litros', (select coalesce(sum(litros), 0) from public.gastos g where g.categoria = 'Combustible' and g.chofer_id is not null and g.fecha between p_desde and p_hasta));
  return jsonb_build_object('yo', s, 'flota', f,
    'meta', (select valor from public.config where clave = 'Meta_tasa_entrega'),
    'bono', jsonb_build_object(
      'porPaquete', (select valor from public.config where clave = 'Bono_por_paquete'),
      'minimo', (select valor from public.config where clave = 'Bono_score_minimo'),
      'completo', (select valor from public.config where clave = 'Bono_score_completo')));
end $$;

revoke execute on function public.chofer_desempeno(date, date) from public, anon;
grant execute on function public.chofer_desempeno(date, date) to authenticated;
