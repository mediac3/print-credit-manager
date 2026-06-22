import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planes")({
  component: PlanesPage,
});

type Plan = {
  id: string;
  nombre: string;
  descripcion: string | null;
  saldo_inicial: number;
  precio_venta: number;
  activo: boolean;
};
type Price = { id: string; plan_id: string; tipo: string; precio_pagina: number };

function PlanesPage() {
  const qc = useQueryClient();
  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("created_at");
      if (error) throw error;
      return data as Plan[];
    },
  });
  const pricesQ = useQuery({
    queryKey: ["prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_prices").select("*");
      if (error) throw error;
      return data as Price[];
    },
  });

  const [newPlan, setNewPlan] = useState({ nombre: "", saldo_inicial: 0, precio_venta: 0 });

  async function addPlan() {
    if (!newPlan.nombre) return toast.error("Nombre requerido");
    const { error } = await supabase.from("plans").insert(newPlan);
    if (error) return toast.error(error.message);
    setNewPlan({ nombre: "", saldo_inicial: 0, precio_venta: 0 });
    qc.invalidateQueries({ queryKey: ["plans"] });
    toast.success("Plan creado");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Planes y tarifas</h2>
        <p className="text-sm text-muted-foreground">Configura los planes (Bronce, Plata, Oro) y el costo por página por tipo de impresión.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crear nuevo plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Nombre</Label>
            <Input value={newPlan.nombre} onChange={(e) => setNewPlan({ ...newPlan, nombre: e.target.value })} />
          </div>
          <div>
            <Label>Saldo inicial</Label>
            <Input type="number" value={newPlan.saldo_inicial} onChange={(e) => setNewPlan({ ...newPlan, saldo_inicial: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Precio de venta</Label>
            <Input type="number" value={newPlan.precio_venta} onChange={(e) => setNewPlan({ ...newPlan, precio_venta: Number(e.target.value) })} />
          </div>
          <div className="flex items-end">
            <Button onClick={addPlan} className="w-full"><Plus className="h-4 w-4 mr-1" />Agregar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plansQ.data?.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            prices={pricesQ.data?.filter((p) => p.plan_id === plan.id) ?? []}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["plans"] });
              qc.invalidateQueries({ queryKey: ["prices"] });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, prices, onChange }: { plan: Plan; prices: Price[]; onChange: () => void }) {
  const [edit, setEdit] = useState(plan);
  const [newPrice, setNewPrice] = useState({ tipo: "", precio_pagina: 0 });

  async function savePlan() {
    const { error } = await supabase.from("plans").update({
      nombre: edit.nombre,
      descripcion: edit.descripcion,
      saldo_inicial: edit.saldo_inicial,
      precio_venta: edit.precio_venta,
      activo: edit.activo,
    }).eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success("Plan actualizado");
    onChange();
  }

  async function addPrice() {
    if (!newPrice.tipo) return toast.error("Tipo requerido");
    const { error } = await supabase.from("print_prices").insert({
      plan_id: plan.id,
      tipo: newPrice.tipo,
      precio_pagina: newPrice.precio_pagina,
    });
    if (error) return toast.error(error.message);
    setNewPrice({ tipo: "", precio_pagina: 0 });
    onChange();
  }

  async function updatePrice(p: Price, value: number) {
    await supabase.from("print_prices").update({ precio_pagina: value }).eq("id", p.id);
    onChange();
  }

  async function deletePrice(id: string) {
    await supabase.from("print_prices").delete().eq("id", id);
    onChange();
  }

  async function deletePlan() {
    if (!confirm(`¿Eliminar plan ${plan.nombre}? Solo si no tiene pines asociados.`)) return;
    const { error } = await supabase.from("plans").delete().eq("id", plan.id);
    if (error) return toast.error(error.message);
    onChange();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{plan.nombre}</CardTitle>
        <CardDescription>Edita los datos y tarifas del plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Precio venta</Label>
            <Input type="number" value={edit.precio_venta} onChange={(e) => setEdit({ ...edit, precio_venta: Number(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Saldo inicial (se asigna al pin)</Label>
            <Input type="number" value={edit.saldo_inicial} onChange={(e) => setEdit({ ...edit, saldo_inicial: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Tarifas por página</div>
          <div className="space-y-2">
            {prices.map((pr) => (
              <div key={pr.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-mono">{pr.tipo}</span>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={pr.precio_pagina}
                  onBlur={(e) => updatePrice(pr, Number(e.target.value))}
                  className="w-24 h-8"
                />
                <Button variant="ghost" size="icon" onClick={() => deletePrice(pr.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
            <Input
              placeholder="ej: bw_carta"
              value={newPrice.tipo}
              onChange={(e) => setNewPrice({ ...newPrice, tipo: e.target.value })}
              className="flex-1 h-8"
            />
            <Input
              type="number"
              step="0.01"
              value={newPrice.precio_pagina}
              onChange={(e) => setNewPrice({ ...newPrice, precio_pagina: Number(e.target.value) })}
              className="w-24 h-8"
            />
            <Button size="icon" variant="outline" onClick={addPrice}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={savePlan} className="flex-1"><Save className="h-4 w-4 mr-1" />Guardar</Button>
          <Button variant="outline" onClick={deletePlan}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}