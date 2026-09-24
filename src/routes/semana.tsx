import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Flame, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateWeekPlan, type WeekPlan } from "@/lib/plan.functions";
import { daysLeft, useFridge } from "@/lib/fridge";

export const Route = createFileRoute("/semana")({
  head: () => ({
    meta: [
      { title: "Plan semanal fitness — FitFridge" },
      { name: "description", content: "7 comidas saludables para la semana, lista de la compra y calorías totales." },
      { property: "og:title", content: "Plan semanal fitness — FitFridge" },
      { property: "og:description", content: "Un plato por día, la compra exacta y las calorías de tu semana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WeekPage,
});

const GOALS = [["perder", "Perder grasa"], ["mantener", "Mantener"], ["ganar", "Ganar músculo"]] as const;
const MEALS = [["comida", "Comida"], ["cena", "Cena"]] as const;
const STORES = [["el más barato", "El más barato"], ["Mercadona", "Mercadona"], ["Lidl", "Lidl"], ["Carrefour", "Carrefour"], ["Dia", "Dia"], ["Aldi", "Aldi"]] as const;
const KEY = "fitfridge-week-plan";

function WeekPage() {
  const { items, addToShop } = useFridge();
  const run = useServerFn(generateWeekPlan);
  const [goal, setGoal] = useState<(typeof GOALS)[number][0]>("perder");
  const [meal, setMeal] = useState<(typeof MEALS)[number][0]>("comida");
  const [budget, setBudget] = useState("120");
  const [store, setStore] = useState<(typeof STORES)[number][0]>("el más barato");
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setPlan(JSON.parse(s)); } catch { /* ignore */ } }, []);

  const go = async () => {
    setLoading(true); setError("");
    try {
      const fridge = items.filter((i) => i.level > 0 && daysLeft(i.expires) >= 0).map((i) => ({ name: i.name, qty: i.qty }));
      const r = await run({ data: { goal, meal, fridge, store, budget: Number(budget) > 0 ? Number(budget) : null } });
      if (r.error || !r.plan) setError(r.error ?? "Error");
      else { setPlan(r.plan); localStorage.setItem(KEY, JSON.stringify(r.plan)); }
    } catch { setError("No se pudo crear el plan. Inténtalo de nuevo."); }
    setLoading(false);
  };

  const total = plan?.days.reduce((s, d) => s + d.kcal, 0) ?? 0;
  const protein = plan?.days.reduce((s, d) => s + d.protein, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Plan semanal</h1>
        <p className="text-muted-foreground">7 platos, uno por día, con la lista de la compra y las calorías de la semana.</p>
      </div>

      <section className="space-y-4 rounded-xl bg-card p-5">
        <Choice label="Tu objetivo" options={GOALS} value={goal} onChange={setGoal} />
        <Choice label="Plato del día" options={MEALS} value={meal} onChange={setMeal} />
          <div>
          <p className="mb-2 text-sm font-medium">Presupuesto para la semana</p>
          <div className="flex items-center gap-2"><input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Sin límite"
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-lg font-bold" /><span className="text-lg">€</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Orientativo: una compra real para 7 días suele costar entre 100 y 150 €.</p>
        </div>
        <Choice label="Supermercado" options={STORES} value={store} onChange={setStore} />
        <Button size="lg" onClick={go} disabled={loading} className="w-full md:w-auto">
          {loading ? <><Loader2 className="animate-spin" /> Preparando tu semana…</> : <><CalendarDays /> {plan ? "Crear otro plan" : "Crear mi plan semanal"}</>}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {plan && (
        <>
          <section className="rounded-xl border border-primary/40 bg-primary/10 p-4">
            <p className="text-sm text-muted-foreground">En {plan.supermarket} puedes comprar todo esto por</p>
            <p className="font-display text-3xl font-bold text-primary">{plan.totalPrice.toFixed(2)} €</p>
            <p className="text-sm">{plan.budgetNote}</p>
          </section>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Calorías en 7 días" value={`${total.toLocaleString("es-ES")} kcal`} />
            <Stat label="Media por día" value={`${Math.round(total / Math.max(1, plan.days.length))} kcal`} />
            <Stat label="Proteína total" value={`${protein} g`} />
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            {plan.days.map((d) => (
              <article key={d.day} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">{d.day}</p>
                    <h3 className="font-display text-lg font-bold">{d.name}</h3>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-primary"><Flame className="size-3" />{d.kcal} kcal</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{d.protein} g proteína · {d.ingredients.join(", ")}</p>
              </article>
            ))}
          </section>

          <section className="rounded-xl bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">Lista de la compra ({plan.shopping.length})</h2>
              <Button variant="outline" onClick={() => { plan.shopping.forEach((s) => addToShop(`${s.item} (${s.quantity})`)); toast.success("Añadido a tu lista de la compra"); }}>
                <ShoppingCart /> Pasar todo a Compra
              </Button>
            </div>
            {Object.entries(plan.shopping.reduce<Record<string, WeekPlan["shopping"]>>((acc, s) => { (acc[s.section] ??= []).push(s); return acc; }, {})).map(([sec, list]) => (
              <div key={sec} className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec}</p>
                <ul className="mt-1 divide-y divide-border">
                  {list.map((s) => <li key={s.item} className="flex justify-between py-1.5 text-sm"><span>{s.item}</span><span className="text-muted-foreground">{s.quantity} · <b className="text-foreground">{s.price.toFixed(2)} €</b></span></li>)}
                </ul>
              </div>
            ))}
            {plan.tip && <p className="mt-2 text-sm text-primary">💡 {plan.tip}</p>}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="font-display text-2xl font-bold">{value}</p></div>;
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`rounded-full border px-3 py-1.5 text-sm ${value === v ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}
