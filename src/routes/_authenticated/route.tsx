import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  Plus,
  Settings2,
  Zap,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

const NAV: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: KanbanSquare },
  { to: "/review", label: "Review queue", icon: ClipboardCheck, roles: ["manager"] },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin", label: "Admin", icon: Settings2, roles: ["admin"] },
];

function AuthenticatedLayout() {
  const { roles, isManager, isAdmin } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const visible = NAV.filter((n) => {
    if (!n.roles) return true;
    if (n.roles.includes("manager") && isManager) return true;
    if (n.roles.includes("admin") && isAdmin) return true;
    return false;
  });

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-60 shrink-0 border-r bg-sidebar flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Zap className="h-4 w-4" />
          </div>
          <div className="font-display text-lg font-semibold">Kilowatt</div>
        </div>

        <nav className="p-3 flex-1 space-y-1">
          {visible.map((item) => {
            const active =
              item.to === "/"
                ? path === "/"
                : path === item.to || path.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/70 hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b bg-card flex items-center px-8 justify-between">
          <div className="font-display text-lg font-semibold capitalize">
            {path === "/" ? "Dashboard" : path.replace(/^\//, "").split("/")[0]}
          </div>
          <div className="flex items-center gap-2">
            {(isManager || roles.includes("submitter")) && (
              <Button
                onClick={() => navigate({ to: "/projects/new" })}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> New Project
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}