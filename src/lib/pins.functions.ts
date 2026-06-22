import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PinImportRow = z.object({
  usuario: z.string().min(1),
  password: z.string().min(1),
  plan: z.string().min(1),
  saldo_inicial: z.number().optional(),
});

export const importPins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: unknown }) =>
    z.object({ rows: z.array(PinImportRow) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { data: plans, error: pErr } = await context.supabase
      .from("plans")
      .select("id,nombre,saldo_inicial");
    if (pErr) throw new Error(pErr.message);
    const planMap = new Map(
      (plans ?? []).map((p) => [p.nombre.toLowerCase(), p]),
    );

    const inserts: Array<{
      usuario: string;
      password_hash: string;
      plan_id: string;
      saldo_inicial: number;
      saldo_actual: number;
      created_by: string;
    }> = [];
    const errors: Array<{ usuario: string; error: string }> = [];

    for (const row of data.rows) {
      const plan = planMap.get(row.plan.toLowerCase());
      if (!plan) {
        errors.push({ usuario: row.usuario, error: `Plan ${row.plan} no existe` });
        continue;
      }
      const saldo = row.saldo_inicial ?? Number(plan.saldo_inicial);
      inserts.push({
        usuario: row.usuario,
        password_hash: await bcrypt.hash(row.password, 10),
        plan_id: plan.id,
        saldo_inicial: saldo,
        saldo_actual: saldo,
        created_by: context.userId,
      });
    }

    if (inserts.length === 0) {
      return { inserted: 0, errors };
    }

    const { error } = await context.supabase.from("pins").insert(inserts);
    if (error) throw new Error(error.message);
    return { inserted: inserts.length, errors };
  });

export const createPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { usuario: string; password: string; plan_id: string; saldo?: number }) =>
    z
      .object({
        usuario: z.string().min(1),
        password: z.string().min(4),
        plan_id: z.string().uuid(),
        saldo: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const bcrypt = (await import("bcryptjs")).default;
    const { data: plan, error: pErr } = await context.supabase
      .from("plans")
      .select("saldo_inicial")
      .eq("id", data.plan_id)
      .single();
    if (pErr) throw new Error(pErr.message);
    const saldo = data.saldo ?? Number(plan.saldo_inicial);
    const { error } = await context.supabase.from("pins").insert({
      usuario: data.usuario,
      password_hash: await bcrypt.hash(data.password, 10),
      plan_id: data.plan_id,
      saldo_inicial: saldo,
      saldo_actual: saldo,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    pin_id: string;
    cliente_nombre?: string;
    cliente_telefono: string;
    precio_venta: number;
  }) =>
    z
      .object({
        pin_id: z.string().uuid(),
        cliente_nombre: z.string().optional(),
        cliente_telefono: z.string().min(7),
        precio_venta: z.number().nonnegative(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: pin, error: pErr } = await context.supabase
      .from("pins")
      .select("id, usuario, estado, plan_id, plans(nombre)")
      .eq("id", data.pin_id)
      .single();
    if (pErr) throw new Error(pErr.message);
    if (pin.estado !== "disponible") throw new Error("El pin ya no está disponible");

    const { data: sale, error: sErr } = await context.supabase
      .from("sales")
      .insert({
        pin_id: data.pin_id,
        cliente_nombre: data.cliente_nombre,
        cliente_telefono: data.cliente_telefono,
        precio_venta: data.precio_venta,
        vendido_por: context.userId,
      })
      .select("id, created_at")
      .single();
    if (sErr) throw new Error(sErr.message);

    return {
      sale_id: sale.id,
      fecha: sale.created_at,
      pin_usuario: pin.usuario,
      plan_nombre: (pin as { plans: { nombre: string } | null }).plans?.nombre ?? "",
    };
  });

export const registerPrintJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    pin_id: string;
    tipo: string;
    paginas: number;
  }) =>
    z
      .object({
        pin_id: z.string().uuid(),
        tipo: z.string().min(1),
        paginas: z.number().int().positive(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("register_print", {
      _pin_id: data.pin_id,
      _tipo: data.tipo,
      _paginas: data.paginas,
      _user: context.userId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [salesToday, salesAll, pinsAll, jobsToday, recentSales] = await Promise.all([
      context.supabase.from("sales").select("precio_venta, created_at").gte("created_at", todayISO),
      context.supabase.from("sales").select("precio_venta, created_at").order("created_at", { ascending: false }).limit(500),
      context.supabase.from("pins").select("id, estado, plan_id, plans(nombre)"),
      context.supabase.from("print_jobs").select("id, costo_total").gte("created_at", todayISO),
      context.supabase
        .from("sales")
        .select("id, precio_venta, cliente_nombre, cliente_telefono, created_at, pins(usuario, plans(nombre))")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const ingresos_hoy = (salesToday.data ?? []).reduce(
      (a, r) => a + Number(r.precio_venta),
      0,
    );
    const ventas_hoy = (salesToday.data ?? []).length;
    const impresiones_hoy = (jobsToday.data ?? []).length;
    const ingresos_impresion_hoy = (jobsToday.data ?? []).reduce(
      (a, r) => a + Number(r.costo_total),
      0,
    );

    const byPlan: Record<string, { disponibles: number; vendidos: number; agotados: number }> = {};
    for (const p of pinsAll.data ?? []) {
      const planName = (p as { plans: { nombre: string } | null }).plans?.nombre ?? "Sin plan";
      if (!byPlan[planName]) byPlan[planName] = { disponibles: 0, vendidos: 0, agotados: 0 };
      if (p.estado === "disponible") byPlan[planName].disponibles++;
      else if (p.estado === "vendido") byPlan[planName].vendidos++;
      else if (p.estado === "agotado") byPlan[planName].agotados++;
    }

    // Últimos 7 días
    const days: Array<{ fecha: string; ventas: number; ingresos: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ fecha: key, ventas: 0, ingresos: 0 });
    }
    for (const s of salesAll.data ?? []) {
      const k = new Date(s.created_at).toISOString().slice(0, 10);
      const slot = days.find((x) => x.fecha === k);
      if (slot) {
        slot.ventas++;
        slot.ingresos += Number(s.precio_venta);
      }
    }

    return {
      ingresos_hoy,
      ventas_hoy,
      impresiones_hoy,
      ingresos_impresion_hoy,
      by_plan: byPlan,
      ultimos_7_dias: days,
      recientes: recentSales.data ?? [],
    };
  });