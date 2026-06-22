import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerPrintJob } from "@/lib/pins.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/impresiones")({
  component: ImpresionesPage,
});

const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function ImpresionesPage() {
  const qc = useQueryClient();
  const printFn = useServerFn(registerPrintJob);
  const [pinId, setPinId] = useState("");
  const [tipo, setTipo] = useState("");
  const [paginas, setPaginas] = useState(1);

  const pinsQ = useQuery({
    queryKey: ["pins-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("id, usuario, saldo_actual, plan_id, estado, plans(nombre)")
        .in("estado", ["vendido", "disponible"])
        .order("usuario");
      if (error) throw error;
      return data;
    },
  });

  const pricesQ = useQuery({
    queryKey: ["prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_prices").select("*");
      if (error) throw error;
      return data;
    },
  });

  const recentQ = useQuery({
    queryKey: ["print-jobs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_jobs")
        .select("id, tipo_impresion, cantidad_paginas, costo_total, saldo_restante, created_at, pins(usuario)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const selected = pinsQ.data?.find((p) => p.id === pinId);
  const availableTypes = useMemo(() => {
    if (!selected || !pricesQ.data) return [];
    return pricesQ.data.filter((pp) => pp.plan_id === selected.plan_id);
  }, [selected, pricesQ.data]);
  const tipoPrice = availableTypes.find((t) => t.tipo === tipo);
  const costoEstimado = tipoPrice ? Number(tipoPrice.precio_pagina) * paginas : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinId || !tipo) return toast.error("Selecciona pin y tipo");
    try {
      await printFn({ data: { pin_id: pinId, tipo, paginas } });
      toast.success("Impresión registrada y saldo descontado");
      setPaginas(1);
      qc.invalidateQueries({ queryKey: ["pins-activos"] });
      qc.invalidateQueries({ queryKey: ["pins"] });
      qc.invalidateQueries({ queryKey: ["print-jobs-recent"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Registrar impresión</h2>
        <p className="text-sm text-muted-foreground">Descuenta saldo del pin según el tipo y cantidad de páginas impresas.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Nueva impresión</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Pin</Label>
                <Select value={pinId} onValueChange={(v) => { setPinId(v); setTipo(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecciona pin" /></SelectTrigger>
                  <SelectContent>
                    {pinsQ.data?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.usuario} — {(p as { plans: { nombre: string } | null }).plans?.nombre} — {fmt.format(Number(p.saldo_actual))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de impresión</Label>
                <Select value={tipo} onValueChange={setTipo} disabled={!selected}>
                  <SelectTrigger><SelectValue placeholder={selected ? "Selecciona tipo" : "Primero elige un pin"} /></SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((t) => (
                      <SelectItem key={t.id} value={t.tipo}>
                        {t.tipo} — {fmt.format(Number(t.precio_pagina))}/pág
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad de páginas</Label>
                <Input type="number" min={1} value={paginas} onChange={(e) => setPaginas(Number(e.target.value))} />
              </div>

              {selected && tipoPrice && (
                <div className="rounded-lg border p-3 bg-muted text-sm space-y-1">
                  <div className="flex justify-between"><span>Saldo actual</span><b>{fmt.format(Number(selected.saldo_actual))}</b></div>
                  <div className="flex justify-between"><span>Costo estimado</span><b>{fmt.format(costoEstimado)}</b></div>
                  <div className="flex justify-between text-primary"><span>Saldo final</span><b>{fmt.format(Number(selected.saldo_actual) - costoEstimado)}</b></div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!pinId || !tipo}>
                <Printer className="h-4 w-4 mr-1" />Registrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Últimas impresiones</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr><th className="py-2">Pin</th><th>Tipo</th><th className="text-right">Pág</th><th className="text-right">Costo</th><th className="text-right">Saldo</th></tr>
                </thead>
                <tbody>
                  {recentQ.data?.map((j) => (
                    <tr key={j.id} className="border-b last:border-0">
                      <td className="py-2 font-mono">{(j as { pins: { usuario: string } | null }).pins?.usuario ?? "-"}</td>
                      <td>{j.tipo_impresion}</td>
                      <td className="text-right">{j.cantidad_paginas}</td>
                      <td className="text-right">{fmt.format(Number(j.costo_total))}</td>
                      <td className="text-right">{fmt.format(Number(j.saldo_restante))}</td>
                    </tr>
                  ))}
                  {(recentQ.data?.length ?? 0) === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sin impresiones aún</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}