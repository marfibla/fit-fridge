import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, ChefHat, Refrigerator, ShoppingCart } from "lucide-react";
import { isExpiring, isLow, missingEssentials, notifyAlerts, useFridge } from "@/lib/fridge";

const NAV = [
  { to: "/", label: "Nevera", icon: Refrigerator },
  { to: "/recetas", label: "Recetas", icon: ChefHat },
  { to: "/semana", label: "Semana", icon: CalendarDays },
  { to: "/compra", label: "Compra", icon: ShoppingCart },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { items, shop, ready } = useFridge();
  const [perm, setPerm] = useState("default");

  useEffect(() => { setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission); }, []);
  useEffect(() => {
    if (!ready) return;
    notifyAlerts(items);
    const t = setInterval(() => notifyAlerts(items), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [items, ready]);

  const alerts = items.filter((i) => isLow(i)).length + (items.length ? missingEssentials(items).length : 0) + shop.filter((s) => !s.done).length;
  const expiring = items.filter(isExpiring).length;

  const enable = async () => {
    if (typeof Notification === "undefined") return setPerm("unsupported");
    if (window.top !== window.self) return setPerm("iframe");
    const r = await Notification.requestPermission();
    setPerm(r);
    if (r === "granted") notifyAlerts(items);
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="rounded-lg bg-primary p-1.5 text-primary-foreground"><Refrigerator className="h-5 w-5" /></span>
            <span className="font-display text-xl font-bold">FitFridge</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: true }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                activeProps={{ className: "bg-secondary !text-foreground" }}>
                <n.icon className="h-4 w-4" /> {n.label}
                {n.to === "/compra" && alerts > 0 && <Badge tone="warm">{alerts}</Badge>}
                {n.to === "/" && expiring > 0 && <Badge tone="destructive">{expiring}</Badge>}
              </Link>
            ))}
          </nav>
          {perm === "granted" ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Bell className="h-4 w-4 text-primary" /> Avisos activos</span>
          ) : (
            <button onClick={enable} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"><Bell className="h-4 w-4" /> Activar avisos</button>
          )}
        </div>
        {perm === "iframe" && <p className="bg-secondary px-4 py-2 text-center text-sm">Para activar los avisos, abre la app en una pestaña nueva o en la versión publicada.</p>}
        {perm === "denied" && <p className="bg-secondary px-4 py-2 text-center text-sm">Has bloqueado las notificaciones. Actívalas en los ajustes del navegador para este sitio.</p>}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-border bg-card md:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} activeOptions={{ exact: true }} className="relative flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground" activeProps={{ className: "!text-primary" }}>
            <n.icon className="h-5 w-5" /> {n.label}
            {n.to === "/compra" && alerts > 0 && <span className="absolute right-1/4 top-2"><Badge tone="warm">{alerts}</Badge></span>}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "warm" | "destructive" }) {
  return <span className={`rounded-full px-1.5 text-[10px] font-bold ${tone === "warm" ? "bg-warm text-warm-foreground" : "bg-destructive text-destructive-foreground"}`}>{children}</span>;
}
