import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole, inviteUser } from "@/lib/users.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/usuarios")({
  component: UsersPage,
});

function UsersPage() {
  const { isAdmin, rolesLoading, user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const invite = useServerFn(inviteUser);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; password: string; role: "admin" | "cajero" }>({
    email: "",
    password: "",
    role: "cajero",
  });

  const q = useQuery({
    queryKey: ["users"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  if (!rolesLoading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center space-y-2 text-muted-foreground">
        <Lock className="h-8 w-8 mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">Acceso restringido</h2>
        <p className="text-sm">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  async function toggle(uid: string, role: "admin" | "cajero", enabled: boolean) {
    try {
      await setRole({ data: { user_id: uid, role, enabled } });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function submitInvite() {
    try {
      await invite({ data: form });
      toast.success("Usuario creado");
      setForm({ email: "", password: "", role: "cajero" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usuarios</h2>
          <p className="text-sm text-muted-foreground">Administra cajeros y administradores del sistema.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Nuevo usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Correo</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Contraseña temporal</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div>
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "cajero" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cajero">Cajero</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Todo usuario nuevo recibe el rol cajero automáticamente. Marca admin para agregarle también ese rol.</p>
            </div>
            <DialogFooter><Button onClick={submitInvite}>Crear</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Cuentas ({q.data?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2">Correo</th>
                  <th>Roles</th>
                  <th className="text-center">Cajero</th>
                  <th className="text-center">Admin</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2">
                      {u.email}
                      {u.id === user?.id && <Badge variant="outline" className="ml-2">tú</Badge>}
                    </td>
                    <td className="space-x-1">
                      {u.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                      {u.roles.length === 0 && <span className="text-muted-foreground text-xs">sin rol</span>}
                    </td>
                    <td className="text-center">
                      <Switch
                        checked={u.roles.includes("cajero")}
                        onCheckedChange={(v) => toggle(u.id, "cajero", v)}
                      />
                    </td>
                    <td className="text-center">
                      <Switch
                        checked={u.roles.includes("admin")}
                        onCheckedChange={(v) => toggle(u.id, "admin", v)}
                      />
                    </td>
                    <td className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString("es-CO")}</td>
                  </tr>
                ))}
                {(q.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{q.isLoading ? "Cargando…" : "Sin usuarios"}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}