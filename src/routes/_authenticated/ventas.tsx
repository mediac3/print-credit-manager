import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerSale } from "@/lib/pins.functions";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ventas")({
  component: VentasPage,
});

const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Receipt = {
  pin_usuario: string;
  pin_password: string;
  plan: string;
  saldo: number;
  precio: number;
  cliente_nombre: string;
  cliente_telefono: string;
  fecha: string;
  cajero_email: string;
};

function VentasPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const saleFn = useServerFn(registerSale);

  const [pinId, setPinId] = useState("");
  const [pinPassword, setPinPassword] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [precio, setPrecio] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const pinsQ = useQuery({
    queryKey: ["pins-disponibles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pins")
        .select("id, usuario, saldo_actual, plan_id, plans(nombre, precio_venta)")
        .eq("estado", "disponible")
        .order("usuario");
      if (error) throw error;
      return data;
    },
  });

  const selected = pinsQ.data?.find((p) => p.id === pinId);

  function onSelectPin(id: string) {
    setPinId(id);
    const p = pinsQ.data?.find((x) => x.id === id);
    if (p) {
      setPrecio(Number((p as { plans: { precio_venta: number } | null }).plans?.precio_venta ?? 0));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinId) return toast.error("Selecciona un pin");
    if (!telefono || telefono.length < 7) return toast.error("Teléfono requerido");
    if (!pinPassword) return toast.error("Captura la contraseña del pin para entregar al cliente");
    try {
      const cleanTel = telefono.replace(/[^0-9]/g, "");
      const res = await saleFn({
        data: { pin_id: pinId, cliente_nombre: cliente, cliente_telefono: cleanTel, precio_venta: precio },
      });
      setReceipt({
        pin_usuario: res.pin_usuario,
        pin_password: pinPassword,
        plan: res.plan_nombre,
        saldo: Number(selected?.saldo_actual ?? 0),
        precio,
        cliente_nombre: cliente,
        cliente_telefono: cleanTel,
        fecha: res.fecha,
        cajero_email: user?.email ?? "",
      });
      setPinId("");
      setPinPassword("");
      setCliente("");
      setTelefono("");
      setPrecio(0);
      qc.invalidateQueries({ queryKey: ["pins-disponibles"] });
      qc.invalidateQueries({ queryKey: ["pins"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Venta registrada");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Vender pin</h2>
        <p className="text-sm text-muted-foreground">Asigna un pin a un cliente y entrega usuario/contraseña.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Datos de venta</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Pin disponible</Label>
              <Select value={pinId} onValueChange={onSelectPin}>
                <SelectTrigger><SelectValue placeholder="Selecciona pin" /></SelectTrigger>
                <SelectContent>
                  {pinsQ.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.usuario} — {(p as { plans: { nombre: string } | null }).plans?.nombre} — saldo {fmt.format(Number(p.saldo_actual))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Contraseña del pin (para el ticket)</Label>
              <Input value={pinPassword} onChange={(e) => setPinPassword(e.target.value)} placeholder="La que se le entrega al cliente" />
              <p className="text-xs text-muted-foreground mt-1">Por seguridad las contraseñas se guardan hasheadas. Captura aquí la que conoces.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre del cliente (opcional)</Label>
                <Input value={cliente} onChange={(e) => setCliente(e.target.value)} />
              </div>
              <div>
                <Label>Teléfono (Colombia) *</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3001234567" />
              </div>
            </div>

            <div>
              <Label>Precio de venta</Label>
              <Input type="number" value={precio} onChange={(e) => setPrecio(Number(e.target.value))} />
            </div>

            <Button type="submit" className="w-full" disabled={!pinId}>Registrar venta</Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="no-print">Venta registrada</DialogTitle></DialogHeader>
          {receipt && <ReceiptView receipt={receipt} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptView({ receipt }: { receipt: Receipt }) {
  const text =
    `🧾 PrintPin — Recibo de compra\n` +
    `Fecha: ${new Date(receipt.fecha).toLocaleString("es-CO")}\n\n` +
    `Pin: ${receipt.pin_usuario}\n` +
    `Contraseña: ${receipt.pin_password}\n` +
    `Plan: ${receipt.plan}\n` +
    `Saldo cargado: ${fmt.format(receipt.saldo)}\n\n` +
    `Cliente: ${receipt.cliente_nombre || "—"}\n` +
    `Total pagado: ${fmt.format(receipt.precio)}\n\n` +
    `Gracias por su compra.`;

  const wa = `https://wa.me/57${receipt.cliente_telefono}?text=${encodeURIComponent(text)}`;

  return (
    <div className="space-y-4">
      <div className="print-area border rounded-lg p-4 bg-white text-black font-mono text-sm space-y-2">
        <div className="text-center font-bold text-base">PrintPin</div>
        <div className="text-center text-xs">Recibo de venta</div>
        <div className="border-t border-dashed my-2"></div>
        <div>Fecha: {new Date(receipt.fecha).toLocaleString("es-CO")}</div>
        <div>Cajero: {receipt.cajero_email}</div>
        <div className="border-t border-dashed my-2"></div>
        <div>Plan: <b>{receipt.plan}</b></div>
        <div>Pin usuario: <b>{receipt.pin_usuario}</b></div>
        <div>Contraseña: <b>{receipt.pin_password}</b></div>
        <div>Saldo cargado: <b>{fmt.format(receipt.saldo)}</b></div>
        <div className="border-t border-dashed my-2"></div>
        <div>Cliente: {receipt.cliente_nombre || "—"}</div>
        <div>Tel: +57 {receipt.cliente_telefono}</div>
        <div className="border-t border-dashed my-2"></div>
        <div className="text-base font-bold">TOTAL: {fmt.format(receipt.precio)}</div>
        <div className="text-center text-xs pt-2">¡Gracias por su compra!</div>
      </div>
      <div className="flex gap-2 no-print">
        <Button onClick={() => window.print()} variant="outline" className="flex-1">
          <Printer className="h-4 w-4 mr-1" />Imprimir
        </Button>
        <a href={wa} target="_blank" rel="noreferrer" className="flex-1">
          <Button className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white">
            <MessageCircle className="h-4 w-4 mr-1" />WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}