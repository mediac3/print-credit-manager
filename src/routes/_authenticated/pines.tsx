import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { importPins, createPin } from "@/lib/pins.functions";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Plus, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/pines")({
  component: PinesPage,
});

const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function PinesPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const importFn = useServerFn(importPins);
  const createFn = useServerFn(createPin);
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Array<{ usuario: string; password: string; plan: string; saldo_inicial?: number }>>([]);
  const [newPin, setNewPin] = useState({ usuario: "", password: "", plan_id: "" });

  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("id,nombre").order("nombre");
      if (error) throw error;
      return data;
    },
  });

  const pinsQ = useQuery({
    queryKey: ["pins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("id, usuario, estado, saldo_actual, saldo_inicial, created_at, plan_id, plans(nombre)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return (pinsQ.data ?? []).filter((p) => {
      if (filterPlan !== "all" && p.plan_id !== filterPlan) return false;
      if (filterEstado !== "all" && p.estado !== filterEstado) return false;
      if (search && !p.usuario.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [pinsQ.data, filterPlan, filterEstado, search]);

  function downloadTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { usuario: "usuario001", password: "1234", plan: "Bronce", saldo_inicial: 5000 },
      { usuario: "usuario002", password: "abcd", plan: "Plata" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "pines");
    XLSX.writeFile(wb, "plantilla_pines.xlsx");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<{ usuario: string; password: string | number; plan: string; saldo_inicial?: number }>(ws);
      setPreviewRows(rows.map((r) => ({
        usuario: String(r.usuario ?? "").trim(),
        password: String(r.password ?? "").trim(),
        plan: String(r.plan ?? "").trim(),
        saldo_inicial: r.saldo_inicial ? Number(r.saldo_inicial) : undefined,
      })));
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    if (previewRows.length === 0) return;
    try {
      const res = await importFn({ data: { rows: previewRows } });
      toast.success(`${res.inserted} pines importados`);
      if (res.errors.length) toast.warning(`${res.errors.length} con errores. Primero: ${res.errors[0].error}`);
      setImportOpen(false);
      setPreviewRows([]);
      qc.invalidateQueries({ queryKey: ["pins"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function submitCreate() {
    try {
      await createFn({ data: newPin });
      toast.success("Pin creado");
      setNewPin({ usuario: "", password: "", plan_id: "" });
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["pins"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pines</h2>
          <p className="text-sm text-muted-foreground">Inventario de pines de impresión</p>
        </div>
        <div className="flex gap-2">
        {isAdmin && (<>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="h-4 w-4 mr-1" />Importar Excel</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Importar pines desde Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-1" />Descargar plantilla
                  </Button>
                  <Input type="file" accept=".xlsx,.xls" onChange={onFile} />
                </div>
                <p className="text-xs text-muted-foreground">Columnas: usuario, password, plan (Bronce/Plata/Oro), saldo_inicial (opcional)</p>
                {previewRows.length > 0 && (
                  <div className="border rounded max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr><th className="p-2 text-left">Usuario</th><th className="text-left">Plan</th><th className="text-right p-2">Saldo</th></tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 100).map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 font-mono">{r.usuario}</td>
                            <td>{r.plan}</td>
                            <td className="text-right p-2">{r.saldo_inicial ?? "(default)"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={confirmImport} disabled={previewRows.length === 0}>
                  Importar {previewRows.length} pines
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Crear pin</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear pin manual</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Usuario</Label><Input value={newPin.usuario} onChange={(e) => setNewPin({ ...newPin, usuario: e.target.value })} /></div>
                <div><Label>Contraseña</Label><Input value={newPin.password} onChange={(e) => setNewPin({ ...newPin, password: e.target.value })} /></div>
                <div>
                  <Label>Plan</Label>
                  <Select value={newPin.plan_id} onValueChange={(v) => setNewPin({ ...newPin, plan_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona plan" /></SelectTrigger>
                    <SelectContent>
                      {plansQ.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={submitCreate}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </>)}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventario ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3 flex-wrap">
            <Input placeholder="Buscar usuario…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                {plansQ.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="disponible">Disponibles</SelectItem>
                <SelectItem value="vendido">Vendidos</SelectItem>
                <SelectItem value="agotado">Agotados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2">Usuario</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th className="text-right">Saldo</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-mono">{p.usuario}</td>
                    <td>{(p as { plans: { nombre: string } | null }).plans?.nombre ?? "-"}</td>
                    <td>
                      <Badge variant={p.estado === "disponible" ? "default" : p.estado === "vendido" ? "secondary" : "outline"}>
                        {p.estado}
                      </Badge>
                    </td>
                    <td className="text-right font-medium">{fmt.format(Number(p.saldo_actual))}</td>
                    <td className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("es-CO")}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Sin pines</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}