import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ChefHat, Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  CATS, CAT_EMOJI, type Category, type Item, LEVEL_LABEL, daysLeft, emojiFor, expiryLabel, isExpiring, isLow, missingEssentials, useFridge,
} from "@/lib/fridge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mi nevera — FitFridge" },
      { name: "description", content: "Ve todo lo que tienes en tu nevera virtual, controla caducidades y lo que se está acabando." },
      { property: "og:title", content: "Mi nevera — FitFridge" },
      { property: "og:description", content: "Tu nevera virtual fitness: caducidades, stock y recetas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FridgePage,
});

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const DEFAULT_DAYS: Record<Category, number> = { Proteína: 3, Lácteo: 10, Verdura: 6, Fruta: 7, Cereal: 90, Otro: 30 };

function FridgePage() {
  const { items, ready, setItems, addToShop } = useFridge();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todo" | "caduca" | "poco">("todo");

  const visible = useMemo(() => items
    .filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    .filter((i) => filter === "todo" || (filter === "caduca" ? isExpiring(i) : isLow(i)))
    .sort((a, b) => a.expires.localeCompare(b.expires)), [items, q, filter]);

  const expiring = items.filter(isExpiring);
  const low = items.filter(isLow);
  const missing = items.length ? missingEssentials(items) : [];

  const setLevel = (it: Item, delta: number) => {
    const level = Math.max(0, Math.min(3, it.level + delta));
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, level } : x)));
    if (level <= 1 && it.level > 1) toast.warning(`${it.name}: ${LEVEL_LABEL[level]?.toLowerCase()}`, { action: { label: "Añadir a la compra", onClick: () => addToShop(it.name) } });
  };
  const remove = (it: Item) => {
    setItems((p) => p.filter((x) => x.id !== it.id));
    toast(`${it.name} eliminado`, { action: { label: "Añadir a la compra", onClick: () => addToShop(it.name) } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Mi nevera</h1>
          <p className="text-muted-foreground">{items.length} productos · {expiring.length} por caducar · {low.length} se acaban</p>
        </div>
        <AddDialog onAdd={(it) => { setItems((p) => [...p, it]); toast.success(`${it.name} guardado en la nevera`); }} />
      </div>

      {ready && items.length > 0 && (expiring.length > 0 || low.length > 0 || missing.length > 0) && (
        <div className="grid gap-3 md:grid-cols-3">
          <Stat tone="destructive" title="A punto de caducar" n={expiring.length} text={expiring.slice(0, 3).map((i) => i.name).join(", ") || "Todo en fecha"} />
          <Stat tone="warm" title="Se está acabando" n={low.length} text={low.slice(0, 3).map((i) => i.name).join(", ") || "Stock correcto"} />
          <Stat tone="accent" title="Te faltan básicos" n={missing.length} text={missing.slice(0, 2).map((m) => m.label.split(" (")[0]).join(", ") || "Nevera completa"} />
        </div>
      )}

      {ready && items.length === 0 ? (
        <EmptyFridge onDemo={() => setItems(() => demoItems())} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la nevera…" className="pl-9" />
            </div>
            {(["todo", "caduca", "poco"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {{ todo: "Todo", caduca: "Por caducar", poco: "Se acaba" }[f]}
              </Button>
            ))}
          </div>

          {/* Nevera visual */}
          <div className="rounded-3xl border-4 border-secondary bg-gradient-to-b from-card to-background p-3 shadow-2xl md:p-5">
            <div className="space-y-3">
              {CATS.map((cat) => {
                const shelf = visible.filter((i) => i.category === cat);
                if (!shelf.length) return null;
                return (
                  <section key={cat} className="rounded-2xl border-b-4 border-secondary bg-secondary/25 p-3">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{CAT_EMOJI[cat]}</span> {cat} <span className="text-xs">({shelf.length})</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {shelf.map((it) => <FoodCard key={it.id} it={it} onLevel={setLevel} onRemove={remove} />)}
                    </div>
                  </section>
                );
              })}
              {visible.length === 0 && <p className="p-8 text-center text-muted-foreground">No hay productos con este filtro.</p>}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Link to="/recetas" className="flex items-center gap-3 rounded-xl bg-primary p-4 text-primary-foreground transition hover:opacity-90">
              <ChefHat className="h-8 w-8" /><div><p className="font-display font-bold">Crear recetas con mi nevera</p><p className="text-sm opacity-80">La IA usa primero lo que caduca antes</p></div>
            </Link>
            <Link to="/compra" className="flex items-center gap-3 rounded-xl bg-card p-4 transition hover:bg-secondary">
              <ShoppingCart className="h-8 w-8 text-warm" /><div><p className="font-display font-bold">Lista de la compra</p><p className="text-sm text-muted-foreground">Lo que se acaba y lo que te falta</p></div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function FoodCard({ it, onLevel, onRemove }: { it: Item; onLevel: (i: Item, d: number) => void; onRemove: (i: Item) => void }) {
  const d = daysLeft(it.expires);
  const ring = d < 0 ? "border-destructive" : d <= 2 ? "border-warm" : "border-transparent";
  const chip = d < 0 ? "bg-destructive text-destructive-foreground" : d <= 2 ? "bg-warm text-warm-foreground" : "bg-secondary text-muted-foreground";
  return (
    <article className={`group relative flex flex-col rounded-xl border-2 ${ring} bg-card p-3 ${it.level === 0 ? "opacity-50" : ""}`}>
      <button aria-label={`Quitar ${it.name}`} onClick={() => onRemove(it)} className="absolute right-2 top-2 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
      <div className="text-4xl">{emojiFor(it)}</div>
      <p className="mt-2 truncate font-medium" title={it.name}>{it.name}</p>
      <p className="text-xs text-muted-foreground">{it.qty || "—"}</p>
      <span className={`mt-2 w-fit rounded-full px-2 py-0.5 text-[11px] ${chip}`}>{expiryLabel(d)}</span>
      <div className="mt-3 flex items-center gap-1">
        <button aria-label="Menos" onClick={() => onLevel(it, -1)} className="rounded bg-secondary p-1 hover:bg-muted"><Minus className="h-3 w-3" /></button>
        <div className="flex flex-1 gap-0.5" title={LEVEL_LABEL[it.level]}>
          {[1, 2, 3].map((n) => <span key={n} className={`h-2 flex-1 rounded-full ${it.level >= n ? (it.level <= 1 ? "bg-warm" : "bg-primary") : "bg-secondary"}`} />)}
        </div>
        <button aria-label="Más" onClick={() => onLevel(it, 1)} className="rounded bg-secondary p-1 hover:bg-muted"><Plus className="h-3 w-3" /></button>
      </div>
      <p className={`mt-1 text-[11px] ${it.level <= 1 ? "text-warm" : "text-muted-foreground"}`}>{LEVEL_LABEL[it.level]}</p>
    </article>
  );
}

function Stat({ tone, title, n, text }: { tone: "destructive" | "warm" | "accent"; title: string; n: number; text: string }) {
  const c = { destructive: "text-destructive border-destructive/40", warm: "text-warm border-warm/40", accent: "text-accent border-accent/40" }[tone];
  return (
    <div className={`rounded-xl border bg-card p-4 ${c}`}>
      <p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4" /> {title}</p>
      <p className="font-display text-3xl font-bold">{n}</p>
      <p className="truncate text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function AddDialog({ onAdd }: { onAdd: (i: Item) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState<Category>("Proteína");
  const [expires, setExpires] = useState(inDays(3));
  const submit = (e: React.FormEvent, keepOpen = false) => {
    e.preventDefault();
    if (!name.trim() || !expires) return;
    onAdd({ id: crypto.randomUUID(), name: name.trim(), qty: qty.trim(), category, expires, added: new Date().toISOString(), level: 3 });
    setName(""); setQty("");
    if (!keepOpen) setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="lg"><Plus /> Añadir compra</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display">Añadir a la nevera</DialogTitle></DialogHeader>
        <form onSubmit={(e) => submit(e, true)} className="space-y-3">
          <div><Label htmlFor="n">Producto</Label><Input id="n" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Pechuga de pollo" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="q">Cantidad</Label><Input id="q" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="500 g" /></div>
            <div><Label htmlFor="e">Caduca el</Label><Input id="e" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} required /></div>
          </div>
          <div>
            <Label>Tipo</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {CATS.map((c) => (
                <button type="button" key={c} onClick={() => { setCategory(c); setExpires(inDays(DEFAULT_DAYS[c])); }}
                  className={`rounded-lg border px-2 py-2 text-sm ${category === c ? "border-primary bg-primary/15" : "border-border"}`}>{CAT_EMOJI[c]} {c}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="outline" className="flex-1">Guardar y añadir otro</Button>
            <Button type="button" className="flex-1" onClick={(e) => submit(e)}>Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmptyFridge({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="rounded-3xl border-4 border-dashed border-secondary p-10 text-center">
      <div className="text-6xl">🧊</div>
      <h2 className="mt-4 font-display text-2xl font-bold">Tu nevera está vacía</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">Añade lo que has comprado con su fecha de caducidad y te avisaremos antes de que se estropee o se acabe.</p>
      <Button variant="outline" className="mt-6" onClick={onDemo}>Probar con una nevera de ejemplo</Button>
    </div>
  );
}

function demoItems(): Item[] {
  const mk = (name: string, qty: string, category: Category, d: number, level = 3): Item =>
    ({ id: crypto.randomUUID(), name, qty, category, expires: inDays(d), added: new Date().toISOString(), level });
  return [
    mk("Pechuga de pollo", "600 g", "Proteína", 2), mk("Huevos", "6 uds", "Proteína", 12, 1), mk("Salmón", "2 filetes", "Proteína", 1),
    mk("Yogur griego", "4 uds", "Lácteo", 8), mk("Queso fresco batido", "500 g", "Lácteo", 6, 2),
    mk("Espinacas", "1 bolsa", "Verdura", 3), mk("Brócoli", "1 ud", "Verdura", 5), mk("Tomates", "4 uds", "Verdura", 4),
    mk("Plátanos", "5 uds", "Fruta", 4), mk("Arándanos", "125 g", "Fruta", 2, 1),
    mk("Arroz integral", "1 kg", "Cereal", 200, 2), mk("Avena", "500 g", "Cereal", 120, 1),
  ];
}
