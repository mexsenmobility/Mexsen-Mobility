// Conexión con Supabase. La llave "anon" es pública por diseño:
// la seguridad la dan las reglas por rol (Row Level Security) dentro de la base de datos.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://daojxupwxktugxmxlghp.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb2p4dXB3eGt0dWd4bXhsZ2hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMzE4MzgsImV4cCI6MjEwNzYwNzgzOH0.U1OrlIt2xx4yZN_4N7-5za_0G7erj03lxH1uRjrPQmA';
export const APP_NAME = 'Mexsen Mobility';
