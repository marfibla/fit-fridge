import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, Flame, Loader2, ShoppingCart, Sparkle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecipeChecker } from "@/components/RecipeChecker";
import { generateRecipes, type AIRecipe } from "@/lib/recipes.functions";
import { daysLeft, useFridge } from "@/lib/fridge";

export const Route = createFileRoute("/recetas")({
  head: () => ({
    meta: [
      { title: "Recetas fitness con tu nevera — FitFridge" },
      { name: "description", content: "Recetas saludables creadas con IA a partir de lo que tienes en la nevera, con calorías y macros." },
      { property: "og:title", content: "Recetas fitness con tu nevera — FitFridge" },
      { property: "og:description", content: "La IA cocina con lo que tienes y prioriza lo que caduca antes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecipesPage,
});

const GOALS = [["perder", "Perder grasa"], ["mantener", "Mantener"], ["ganar", "Ganar músculo"]] as const;
const MEALS = [["cualquiera", "Cualquiera"], ["desayuno", "Desayuno"], ["comida", "Comida"], ["cena", "Cena"], ["snack", "Snack"]] as const;

function RecipesPage() {
  const { items, addToShop } = useFridge();
  const run = useServerFn(generateRecipes);
  const [goal, setGoal] = useState<(typeof GOALS)[number][0]>("perder");
  const [meal, setMeal] = useState<(typeof MEALS)[number][0]>("cualquiera");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<AIRecipe[]>([]);
  const [error, setError] = useState("");
  const available = items.filter((i) => i.level > 0 && daysLeft(i.expires) >= 0);

  const go = async () => {
    setLoading(true); setError("");
    try {
      const r = await run({ data: { goal, meal, fridge: available.map((i) => ({ name: i.name, qty: i.qty, expiresInDays: daysLeft(i.expires) })) } });
      if (r.error) setError(r.error); else setRecipes(r.recipes ?? []);
    } catch { setError("No se pudieron generar recetas. Inténtalo de nuevo."); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Recetas con tu nevera</h1>
        <p className="text-muted-foreground">Ideas fitness con lo que tienes, empezando por lo que caduca antes.</p>
      </div>

      <section className="space-y-4 rounded-xl bg-card p-5">
        <Choice label="Tu objetivo" options={GOALS} value={goal} onChange={setGoal} />
        <Choice label="¿Para cuándo?" options={MEALS} value={meal} onChange={setMeal} />
        {available.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tu nevera está vacía. <Link to="/" className="text-primary underline">Añade productos</Link> para recibir recetas.</p>
        ) : (
          <Button size="lg" onClick={go} disabled={loading} className="w-full md:w-auto">
            {loading ? <><Loader2 className="animate-spin" /> Cocinando ideas…</> : <><Wand2 /> Crear recetas con mis {available.length} productos</>}
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      {loading && <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-card" />)}</div>}

      {!loading && recipes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {recipes.map((r) => (
            <article key={r.name} className="flex flex-col rounded-xl bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.meal}</p>
                  <h3 className="font-display text-xl font-bold">{r.name}</h3>
                </div>
                {r.usesExpiring && <span className="flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-0.5 text-xs text-warm-foreground"><Sparkle className="h-3 w-3" /> Salva comida</span>}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <Macro icon={<Flame className="h-3 w-3" />} v={`${r.kcal}`} l="kcal" />
                <Macro v={`${r.protein} g`} l="proteína" hl />
                <Macro v={`${r.carbs} g`} l="hidratos" />
                <Macro v={`${r.fat} g`} l="grasa" />
              </div>
              <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> {r.minutes} min</p>
              <ul className="mt-3 space-y-1 text-sm">
                {r.ingredients.map((g) => (
                  <li key={g.item} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">{g.inFridge ? <Check className="h-3.5 w-3.5 text-primary" /> : <ShoppingCart className="h-3.5 w-3.5 text-warm" />}{g.item} <span className="text-muted-foreground">· {g.amount}</span></span>
                    {!g.inFridge && <button onClick={() => { addToShop(g.item); toast.success(`${g.item} añadido a la compra`); }} className="text-xs text-warm underline">+ compra</button>}
                  </li>
                ))}
              </ul>
              <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </article>
          ))}
        </div>
      )}

      <RecipeChecker items={items} />
    </div>
  );
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => <Button key={v} size="sm" variant={value === v ? "default" : "outline"} onClick={() => onChange(v)}>{l}</Button>)}
      </div>
    </div>
  );
}

function Macro({ v, l, icon, hl }: { v: string; l: string; icon?: React.ReactNode; hl?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${hl ? "bg-primary/15 text-primary" : "bg-secondary"}`}>
      <p className="flex items-center justify-center gap-1 font-bold">{icon}{v}</p><p className="text-muted-foreground">{l}</p>
    </div>
  );
}
