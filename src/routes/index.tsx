import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, ChefHat, Plus, Refrigerator, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type Category, type Item, daysLeft, expiryLabel, loadItems, notifyExpiring, saveItems, suggest,
} from "@/lib/fridge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FitFridge — Tu nevera virtual fitness" },
      { name: "description", content: "Añade tu compra con fecha de caducidad, recibe avisos y recetas fitness con lo que tienes." },
      { property: "og:title", content: "FitFridge — Tu nevera virtual fitness" },
      { property: "og:description", content: "Controla caducidades y cocina sano con lo que hay en tu nevera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CATS: Category[] = ["Proteína", "Verdura", "Fruta", "Lácteo", "Cereal", "Otro"];
const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function Index() {
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState<Category>("Proteína");
  const [expires, setExpires] = useState(inDays(5));

  useEffect(() => {
    setItems(loadItems());
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveItems(items);
    notifyExpiring(items);
    const t = setInterval(() => notifyExpiring(items), 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [items, ready]);

  const sorted = useMemo(() => [...items].sort((a, b) => a.expires.localeCompare(b.expires)), [items]);
  const expiring = sorted.filter((i) => daysLeft(i.expires) <= 2);
  const recipes = useMemo(() => suggest(items), [items]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !expires) return;
    setItems((p) => [...p, { id: crypto.randomUUID(), name: name.trim(), qty: qty.trim(), category, expires, added: new Date().toISOString() }]);
    setName(""); setQty(""); setExpires(inDays(5));
  };

  const enableAlerts = async () => {
    if (typeof Notification === "undefined") return setPerm("unsupported");
    if (window.top !== window.self) return setPerm("iframe");
    const r = await Notification.requestPermission();
    setPerm(r);
    if (r === "granted") notifyExpiring(items);
  };

  const tone = (n: number) =>
    n < 0 ? "bg-destructive text-destructive-foreground" : n <= 2 ? "bg-warm text-warm-foreground" : "bg-secondary text-secondary-foreground";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground"><Refrigerator className="h-7 w-7" /></div>
            <div>
              <h1 className="font-display text-3xl font-bold">FitFridge</h1>
              <p className="text-sm text-muted-foreground">Tu nevera virtual para comer sano sin tirar comida</p>
            </div>
          </div>
          {perm === "granted" ? (
            <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm"><Bell className="h-4 w-4 text-primary" /> Avisos activados</span>
          ) : (
            <Button onClick={enableAlerts} variant="outline"><Bell /> Activar avisos de caducidad</Button>
          )}
        </header>

        {perm === "iframe" && <Notice>Para activar los avisos, abre la app en una pestaña nueva (botón de abrir en ventana) o en la versión publicada.</Notice>}
        {perm === "denied" && <Notice><BellOff className="inline h-4 w-4" /> Has bloqueado las notificaciones. Actívalas en los ajustes del navegador para este sitio.</Notice>}
        {perm === "unsupported" && <Notice>Tu navegador no admite notificaciones; verás los avisos aquí dentro.</Notice>}

        {expiring.length > 0 && (
          <section className="mb-6 rounded-xl border border-warm/50 bg-warm/10 p-4">
            <h2 className="mb-2 font-display font-bold text-warm">⚠ A punto de caducar</h2>
            <ul className="flex flex-wrap gap-2">
              {expiring.map((i) => (
                <li key={i.id} className={`rounded-full px-3 py-1 text-sm ${tone(daysLeft(i.expires))}`}>{i.name} · {expiryLabel(daysLeft(i.expires))}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <section className="rounded-xl bg-card p-5">
            <h2 className="mb-4 font-display text-xl font-bold">Añadir compra</h2>
            <form onSubmit={add} className="space-y-3">
              <div><Label htmlFor="n">Producto</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pechuga de pollo" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="q">Cantidad</Label><Input id="q" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="500 g" /></div>
                <div>
                  <Label htmlFor="c">Tipo</Label>
                  <select id="c" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                    {CATS.map((c) => <option key={c} className="bg-card">{c}</option>)}
                  </select>
                </div>
              </div>
              <div><Label htmlFor="e">Fecha de caducidad</Label><Input id="e" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} required /></div>
              <Button type="submit" className="w-full"><Plus /> Guardar en la nevera</Button>
            </form>
          </section>

          <section className="rounded-xl bg-card p-5">
            <h2 className="mb-4 font-display text-xl font-bold">Mi nevera <span className="text-muted-foreground">({items.length})</span></h2>
            {sorted.length === 0 ? (
              <p className="text-muted-foreground">Tu nevera está vacía. Añade lo que has comprado.</p>
            ) : (
              <ul className="space-y-2">
                {sorted.map((i) => {
                  const n = daysLeft(i.expires);
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.name} {i.qty && <span className="text-sm text-muted-foreground">· {i.qty}</span>}</p>
                        <p className="text-xs text-muted-foreground">{i.category}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${tone(n)}`}>{expiryLabel(n)}</span>
                        <Button size="icon" variant="ghost" aria-label={`Quitar ${i.name}`} onClick={() => setItems((p) => p.filter((x) => x.id !== i.id))}><Trash2 /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-xl bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><ChefHat className="text-primary" /> Recetas fitness para ti</h2>
          {recipes.length === 0 ? (
            <p className="text-muted-foreground">Añade productos como pollo, huevos, arroz o yogur para ver ideas.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recipes.map((r) => (
                <article key={r.name} className="rounded-lg border border-border p-4">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold">{r.name}</h3>
                    {r.urgent && <span className="rounded-full bg-warm px-2 py-0.5 text-xs text-warm-foreground">Aprovecha antes de que caduque</span>}
                  </div>
                  <p className="text-sm text-primary">{r.kcal} kcal · {r.protein} g proteína</p>
                  <p className="mt-2 text-sm text-muted-foreground">{r.steps}</p>
                  {r.missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Te falta: {r.missing.join(", ")}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 rounded-lg bg-secondary p-3 text-sm">{children}</p>;
}
