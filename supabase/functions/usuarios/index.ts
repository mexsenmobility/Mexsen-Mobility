// Edge Function "usuarios": alta de usuarios y cambio de PIN.
// Usa la llave de servicio del lado del servidor; nunca llega al navegador.
//   estado      → { hayAdmin }                          (público)
//   bootstrap   → crea el PRIMER administrador           (público, solo si no hay ninguno)
//   crear       → crea chofer o admin                    (solo admin)
//   pin         → cambia el PIN de un usuario            (solo admin)
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const DOMINIO = "flotilla.app";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (msg: string, status = 400) => json({ error: msg }, status);

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const reUsuario = /^[a-z0-9._-]{3,20}$/;
const rePin = /^\d{6}$/;

async function hayAdmin() {
  const { count, error } = await admin.from("perfiles").select("id", { count: "exact", head: true }).eq("rol", "admin");
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function quienLlama(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data?.user) return null;
  const { data: p } = await admin.from("perfiles").select("id, rol, activo").eq("id", data.user.id).maybeSingle();
  return p;
}

async function crearUsuario(d: Record<string, unknown>, rolForzado?: string) {
  const usuario = String(d.usuario || "").trim().toLowerCase();
  const nombre = String(d.nombre || "").trim();
  const pin = String(d.pin || "").trim();
  if (!nombre) throw new Error("Escribe el nombre");
  if (!reUsuario.test(usuario)) throw new Error("Usuario: 3 a 20 letras minúsculas o números, sin espacios");
  if (!rePin.test(pin)) throw new Error("El PIN debe tener exactamente 6 números");
  const rol = rolForzado || (d.rol === "admin" ? "admin" : "chofer");
  const { data: existe } = await admin.from("perfiles").select("id").eq("usuario", usuario).maybeSingle();
  if (existe) throw new Error("Ese usuario ya existe");

  const { data, error } = await admin.auth.admin.createUser({
    email: `${usuario}@${DOMINIO}`, password: pin, email_confirm: true, user_metadata: { nombre },
  });
  if (error || !data.user) throw new Error(error?.message?.includes("registered") ? "Ese usuario ya existe" : (error?.message || "No se pudo crear"));

  const { error: e2 } = await admin.from("perfiles").insert({
    id: data.user.id, nombre, usuario, rol,
    telefono: d.telefono || null, licencia_vence: d.licencia_vence || null,
    sueldo_semanal: d.sueldo_semanal ? Number(d.sueldo_semanal) : null,
  });
  if (e2) { await admin.auth.admin.deleteUser(data.user.id); throw new Error(e2.message); }
  return { id: data.user.id, usuario };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("Método no permitido", 405);
  try {
    const { action, data = {} } = await req.json();

    if (action === "estado") return json({ hayAdmin: await hayAdmin() });

    if (action === "bootstrap") {
      if (await hayAdmin()) return fail("Ya existe un administrador. Entra con tu usuario y PIN.", 403);
      return json(await crearUsuario(data, "admin"));
    }

    const yo = await quienLlama(req);
    if (!yo || yo.rol !== "admin" || !yo.activo) return fail("No tienes permiso para esto", 403);

    if (action === "crear") return json(await crearUsuario(data));

    if (action === "pin") {
      const pin = String(data.pin || "");
      if (!rePin.test(pin)) return fail("El PIN debe tener exactamente 6 números");
      const { error } = await admin.auth.admin.updateUserById(String(data.id), { password: pin });
      if (error) return fail(error.message);
      return json({ ok: true });
    }
    return fail("Acción no válida");
  } catch (e) {
    return fail((e as Error).message || "Error");
  }
});
