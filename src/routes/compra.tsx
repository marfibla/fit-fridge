import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Check, PackageX, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEVEL_LABEL, daysLeft, emojiFor, isLow, missingEssentials, useFridge } from "@/lib/fridge";

export const Route = createFileRoute("/compra")({
  head: () => ({
    meta: [
      { title: "Lista de la compra — FitFridge" },
      { name: "description", content: "Avisos de comida que se acaba, básicos fitness que faltan y tu lista de la compra." },
      { property: "og:title", content: "Lista de la compra — FitFridge" },
      { property: "og:description", content: "Nunca te quedes sin comida sana en casa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const { items, shop, setShop, addToShop, ready } = useFridge();
  const [name, setName] = useState("");
  const low = items.filter(isLow);
  const expired = items.filter((i) => daysLeft(i.expires) < 0);
  const missing = items.length ? missingEssentials(items) : [];
  const pending = shop.filter((s) => !s.done);
  const done = shop.filter((s) => s.done);
  const inList = (n: string) => pending.some((s) => s.name.toLowerCase() === n.toLowerCase());

  const add = (e: React.FormEvent) => { e.preventDefault(); if (name.trim()) { addToShop(name.trim()); setName(""); } };
  const addAll = () => {
    [...low.map((i) => i.name), ...expired.map((i) => i.name), ...missing.map((m) => m.label.split(" (")[0] ?? m.label)].forEach(addToShop);
    toast.success("Todo añadido a la lista");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Lista de la compra</h1>
          <p className="text-muted-foreground">Te avisamos de lo que se acaba para que nunca te falte comida sana.</p>
        </div>
        {ready && (low.length + expired.length + missing.length > 0) && <Button onClick={addAll}><Plus /> Añadir todos los avisos</Button>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <AlertBox title="Se está acabando" icon={<AlertTriangle className="h-4 w-4" />} tone="text-warm" empty="Nada se está acabando">
          {low.map((i) => <Row key={i.id} emoji={emojiFor(i)} name={i.name} sub={LEVEL_LABEL[i.level] ?? ""} added={inList(i.name)} onAdd={() => addToShop(i.name)} />)}
        </AlertBox>
        <AlertBox title="Caducado, reponer" icon={<PackageX className="h-4 w-4" />} tone="text-destructive" empty="Nada caducado">
          {expired.map((i) => <Row key={i.id} emoji={emojiFor(i)} name={i.name} sub="Caducado" added={inList(i.name)} onAdd={() => addToShop(i.name)} />)}
        </AlertBox>
        <AlertBox title="Básicos fitness que faltan" icon={<AlertTriangle className="h-4 w-4" />} tone="text-accent" empty={items.length ? "Tienes todos los básicos" : "Añade productos a tu nevera"}>
          {missing.map((m) => { const n = m.label.split(" (")[0] ?? m.label; return <Row key={m.label} emoji="🛒" name={n} sub={m.label.includes("(") ? m.label.slice(m.label.indexOf("(")) : "Básico"} added={inList(n)} onAdd={() => addToShop(n)} />; })}
        </AlertBox>
      </div>

      <section className="rounded-xl bg-card p-5">
        <h2 className="mb-4 font-display text-xl font-bold">Mi lista ({pending.length})</h2>
        <form onSubmit={add} className="mb-4 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Añadir producto…" maxLength={80} />
          <Button type="submit"><Plus /> Añadir</Button>
        </form>
        {pending.length === 0 && done.length === 0 && <p className="text-muted-foreground">Tu lista está vacía.</p>}
        <ul className="space-y-2">
          {[...pending, ...done].map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
              <button aria-label="Marcar comprado" onClick={() => setShop((p) => p.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                className={`flex h-5 w-5 items-center justify-center rounded border ${s.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                {s.done && <Check className="h-3 w-3" />}
              </button>
              <span className={`flex-1 ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.name}</span>
              <button aria-label={`Quitar ${s.name}`} onClick={() => setShop((p) => p.filter((x) => x.id !== s.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        {done.length > 0 && <Button variant="ghost" size="sm" className="mt-3" onClick={() => setShop((p) => p.filter((x) => !x.done))}>Borrar comprados</Button>}
      </section>
    </div>
  );
}

function AlertBox({ title, icon, tone, empty, children }: { title: string; icon: React.ReactNode; tone: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="rounded-xl bg-card p-4">
      <h2 className={`mb-3 flex items-center gap-2 font-semibold ${tone}`}>{icon} {title} <span className="text-muted-foreground">({children.length})</span></h2>
      {children.length ? <ul className="space-y-2">{children}</ul> : <p className="text-sm text-muted-foreground">✓ {empty}</p>}
    </section>
  );
}

function Row({ emoji, name, sub, added, onAdd }: { emoji: string; name: string; sub: string; added: boolean; onAdd: () => void }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="text-xl">{emoji}</span>
      <div className="min-w-0 flex-1"><p className="truncate">{name}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
      <Button size="sm" variant={added ? "ghost" : "outline"} disabled={added} onClick={onAdd}>{added ? <Check /> : <Plus />}</Button>
    </li>
  );
}
