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
import { ScanDialog } from "@/components/ScanDialog";

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
    <div className="space-y-8">
      {/* Puerta del congelador: título + imanes */}
      <div className="fridge relative overflow-hidden p-6 md:p-8">
        <span className="absolute right-5 top-1/2 hidden h-20 w-2 -translate-y-1/2 rounded-full bg-foreground/15 md:block" />
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end md:pr-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Tu nevera virtual</p>
            <h1 className="font-display text-5xl md:text-6xl">Mi Nevera</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold uppercase tracking-wide">
              <span className="opacity-70">{items.length} productos</span>
              <span className="text-destructive">{expiring.length} por caducar</span>
              <span className="text-warm">{low.length} se acaban</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ScanDialog onAdd={(it) => { setItems((p) => [...p, it]); toast.success(`${it.name} guardado en la nevera`); }} />
            <AddDialog onAdd={(it) => { setItems((p) => [...p, it]); toast.success(`${it.name} guardado en la nevera`); }} />
          </div>
        </div>

        {ready && items.length > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Magnet tilt={-2} color="bg-warm/40" title="A punto de caducar" n={expiring.length} text={expiring.slice(0, 3).map((i) => i.name).join(", ") || "Todo en fecha ✓"} />
            <Magnet tilt={1.5} color="bg-accent/50" title="Se está acabando" n={low.length} text={low.slice(0, 3).map((i) => i.name).join(", ") || "Stock correcto ✓"} />
            <Magnet tilt={-1} color="bg-secondary" title="Te faltan básicos" n={missing.length} text={missing.slice(0, 2).map((m) => m.label.split(" (")[0]).join(", ") || "Nevera completa ✓"} />
          </div>
        )}
      </div>

      {ready && items.length === 0 ? (
        <EmptyFridge onDemo={() => setItems(() => demoItems())} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la nevera…" className="h-11 rounded-full border-none bg-accent/30 pl-10" />
            </div>
            {(["todo", "caduca", "poco"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-full border-2 border-foreground px-4 py-2 text-sm font-bold transition ${filter === f ? "bg-primary text-primary-foreground" : "hover:bg-primary/10"}`}>
                {{ todo: "Todo", caduca: "Por caducar", poco: "Se acaba" }[f]}
              </button>
            ))}
          </div>

          {/* Interior de la nevera: estantes en mosaico */}
          <div className="fridge p-4 md:p-6">
            <div className="grid grid-cols-12 gap-4">
              {CATS.map((cat) => {
                const shelf = visible.filter((i) => i.category === cat);
                if (!shelf.length) return null;
                const st = SHELF[cat];
                return (
                  <section key={cat} className={`rise shelf-edge col-span-12 rounded-3xl border p-5 ${st.cls} ${shelf.length > 2 ? st.span : "md:col-span-6 lg:col-span-4"}`}>
                    <h2 className="mb-4 flex items-baseline justify-between">
                      <span className="font-display text-2xl">{CAT_EMOJI[cat]} {cat}</span>
                      <span className="text-xs font-bold uppercase tracking-wider opacity-60">{shelf.length}</span>
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                      {shelf.map((it) => <FoodCard key={it.id} it={it} onLevel={setLevel} onRemove={remove} />)}
                    </div>
                  </section>
                );
              })}
              {visible.length === 0 && <p className="col-span-12 p-8 text-center text-muted-foreground">No hay productos con este filtro.</p>}
            </div>
            <div className="mx-auto mt-5 h-2 w-1/3 rounded-full bg-foreground/5" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/recetas" className="wobble magnet flex items-center gap-4 rounded-3xl bg-primary p-5 text-primary-foreground">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><ChefHat className="h-7 w-7" /></span>
              <div><p className="font-display text-xl">Cocinar con mi nevera</p><p className="text-sm opacity-75">La IA usa primero lo que caduca antes</p></div>
            </Link>
            <Link to="/compra" className="wobble magnet flex items-center gap-4 rounded-3xl bg-warm/40 p-5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-card"><ShoppingCart className="h-7 w-7" /></span>
              <div><p className="font-display text-xl">Lista de la compra</p><p className="text-sm opacity-75">Lo que se acaba y lo que te falta</p></div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

const SHELF: Record<Category, { cls: string; span: string }> = {
  Proteína: { cls: "bg-accent/30 border-accent", span: "lg:col-span-8" },
  Lácteo: { cls: "bg-card border-border", span: "lg:col-span-4" },
  Verdura: { cls: "bg-warm/15 border-warm/60", span: "md:col-span-6" },
  Fruta: { cls: "bg-accent/45 border-accent", span: "md:col-span-6" },
  Cereal: { cls: "bg-secondary border-border", span: "lg:col-span-7" },
  Otro: { cls: "bg-card border-border", span: "lg:col-span-5" },
};

function FoodCard({ it, onLevel, onRemove }: { it: Item; onLevel: (i: Item, d: number) => void; onRemove: (i: Item) => void }) {
  const d = daysLeft(it.expires);
  const pct = Math.max(0.05, Math.min(1, d / 14));
  const stroke = d < 0 ? "var(--destructive)" : d <= 2 ? "var(--coral)" : "var(--mint)";
  const chip = d < 0 ? "bg-destructive text-destructive-foreground" : d <= 2 ? "bg-warm text-warm-foreground" : "bg-secondary text-muted-foreground";
  return (
    <article className={`chip-in group relative flex flex-col items-center rounded-2xl border border-card bg-card/70 p-3 text-center transition hover:-translate-y-1 hover:shadow-lg ${it.level === 0 ? "opacity-50" : ""}`}>
      <button aria-label={`Quitar ${it.name}`} onClick={() => onRemove(it)} className="absolute right-2 top-2 text-muted-foreground opacity-40 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
      <div className="relative h-16 w-16" title={expiryLabel(d)}>
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" stroke="var(--secondary)" strokeWidth="3" />
          <circle cx="18" cy="18" r="16" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct * 100.5} 100.5`} />
        </svg>
        <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-card text-3xl shadow-sm">{emojiFor(it)}</div>
      </div>
      <p className="mt-2 w-full truncate text-sm font-bold" title={it.name}>{it.name}</p>
      <p className="text-xs text-muted-foreground">{it.qty || "—"}</p>
      <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip}`}>{expiryLabel(d)}</span>
      <div className="mt-2 flex w-full items-center gap-1">
        <button aria-label="Menos" onClick={() => onLevel(it, -1)} className="rounded-full bg-secondary p-1 hover:bg-muted"><Minus className="h-3 w-3" /></button>
        <div className="flex flex-1 gap-1" title={LEVEL_LABEL[it.level]}>
          {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${it.level >= n ? (it.level <= 1 ? "bg-warm" : "bg-primary") : "bg-primary/15"}`} />)}
        </div>
        <button aria-label="Más" onClick={() => onLevel(it, 1)} className="rounded-full bg-secondary p-1 hover:bg-muted"><Plus className="h-3 w-3" /></button>
      </div>
      <p className={`mt-1 text-[11px] font-semibold ${it.level <= 1 ? "text-destructive" : "text-muted-foreground"}`}>{LEVEL_LABEL[it.level]}</p>
    </article>
  );
}

function Magnet({ tilt, color, title, n, text }: { tilt: number; color: string; title: string; n: number; text: string }) {
  return (
    <div style={{ ["--tilt" as string]: `${tilt}deg`, transform: `rotate(${tilt}deg)` }} className={`wobble magnet relative rounded-2xl p-4 ${color}`}>
      <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-primary shadow" />
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><AlertTriangle className="h-3.5 w-3.5" /> {title}</p>
      <p className="font-display text-4xl">{n}</p>
      <p className="truncate text-sm opacity-75">{text}</p>
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
      <DialogTrigger asChild><Button size="lg" className="rounded-full"><Plus /> Añadir compra</Button></DialogTrigger>
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
    <div className="fridge border-4 border-dashed border-accent p-10 text-center">
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
