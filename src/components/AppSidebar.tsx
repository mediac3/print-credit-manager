import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Printer,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Pines", url: "/pines", icon: Package },
  { title: "Planes y tarifas", url: "/planes", icon: Tag },
  { title: "Vender pin", url: "/ventas", icon: ShoppingCart },
  { title: "Registrar impresión", url: "/impresiones", icon: Printer },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { signOut, user } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Printer className="h-4 w-4" />
          </div>
          {!collapsed && <span className="font-semibold">PrintPin</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && user && (
          <div className="px-2 pb-1 text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}