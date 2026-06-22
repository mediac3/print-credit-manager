import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/pins.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ShoppingCart, Printer, Package } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

function DashboardPage() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fn(),
    refetchInterval: 30000,
  });

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Resumen de operación de hoy</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Ingresos hoy (ventas)" value={fmt.format(data.ingresos_hoy)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Ventas hoy" value={String(data.ventas_hoy)} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Impresiones hoy" value={String(data.impresiones_hoy)} icon={<Printer className="h-4 w-4" />} />
        <StatCard label="Cobrado en impresión" value={fmt.format(data.ingresos_impresion_hoy)} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventas últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.ultimos_7_dias}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="fecha" tickFormatter={(v) => v.slice(5)} fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="ingresos" stroke="var(--primary)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Pines por plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(data.by_plan).map(([plan, counts]) => (
              <div key={plan} className="space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span>{plan}</span>
                  <span className="text-muted-foreground">{counts.disponibles + counts.vendidos + counts.agotados} total</span>
                </div>
                <div className="flex gap-1 text-xs">
                  <Badge variant="outline" className="border-success/40 text-success">Disp: {counts.disponibles}</Badge>
                  <Badge variant="outline">Vend: {counts.vendidos}</Badge>
                  <Badge variant="outline" className="border-destructive/40 text-destructive">Agot: {counts.agotados}</Badge>
                </div>
              </div>
            ))}
            {Object.keys(data.by_plan).length === 0 && (
              <p className="text-sm text-muted-foreground">Sin pines aún.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2">Fecha</th>
                  <th>Pin</th>
                  <th>Plan</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th className="text-right">Precio</th>
                </tr>
              </thead>
              <tbody>
                {(data.recientes as Array<{
                  id: string;
                  created_at: string;
                  precio_venta: number;
                  cliente_nombre: string | null;
                  cliente_telefono: string;
                  pins: { usuario: string; plans: { nombre: string } | null } | null;
                }>).map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(r.created_at).toLocaleString("es-CO")}</td>
                    <td className="font-mono">{r.pins?.usuario ?? "-"}</td>
                    <td>{r.pins?.plans?.nombre ?? "-"}</td>
                    <td>{r.cliente_nombre ?? "-"}</td>
                    <td>{r.cliente_telefono}</td>
                    <td className="text-right">{fmt.format(Number(r.precio_venta))}</td>
                  </tr>
                ))}
                {data.recientes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">Sin ventas aún</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}