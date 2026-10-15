# Mexsen Mobility

Sistema de gestión de la flotilla de reparto de última milla (Mercado Libre) de Mexsen Mobility, Torreón.

## Qué hace
- **Choferes** (desde el celular): checklist de la van con foto, escaneo de paquetes con la cámara, incidencias con foto y ubicación, cargas de gasolina con ticket, cierre de ruta y mensajes con el administrador. Solo ven su ruta del día.
- **Administrador**: rutas del día, flota (km, mantenimientos, vencimientos, GPS), choferes, gastos, pagos de Mercado Libre, incidencias y mensajes.
- **Dirección**: 19 KPIs con semáforo e interpretación, calificación de salud de la empresa y plan de crecimiento a 1, 3 y 6 meses generado con los datos.

## Tecnología
- Next.js 14 (exportación estática) + TypeScript + Tailwind, publicada en Vercel.
- Supabase: PostgreSQL con Row Level Security por rol, Storage privado para fotos y la función `usuarios` para altas y cambio de PIN.

## Estructura
```
app/            pantallas (login, setup, chofer/*, admin/*)
components/     piezas de interfaz (shell, escáner, KPIs, chat)
lib/api.js      capa de datos (todas las acciones de la app)
lib/kpis.js     motor de KPIs, diagnóstico y plan
supabase/       esquema SQL, almacenamiento y función de usuarios
test/           pruebas de punta a punta y de seguridad
```

## Desarrollo
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # genera /out
```
La conexión a Supabase está en `lib/config.ts` (se puede sobreescribir con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`). La llave anon es pública por diseño; la seguridad está en las políticas RLS de `supabase/schema.sql`.
