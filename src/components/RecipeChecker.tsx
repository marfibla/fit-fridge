import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, MapPin, Search, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkRecipe, type RecipeCheck } from "@/lib/recipe-check.functions";
import type { Item } from "@/lib/fridge";

export function RecipeChecker({ items }: { items: Item[] }) {
  const run = useServerFn(checkRecipe);
  const [recipe, setRecipe] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<RecipeCheck | null>(null);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipe.trim().length < 2) return;
    setLoading(true); setError(""); setRes(null);
    try {
      const out = await run({ data: { recipe, fridge: items.map((i) => ({ name: i.name, qty: i.qty })) } });
      if (out.error) setError(out.error); else if (out.result) setRes(out.result);
    } catch { setError("No se pudo analizar la receta. Inténtalo de nuevo."); }
    setLoading(false);
  };

  return (
    <section className="mt-6 rounded-xl bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-bold"><ShoppingCart className="text-primary" /> ¿Qué quieres cocinar?</h2>
      <p className="mb-4 text-sm text-muted-foreground">Dime una receta y te digo qué te falta y dónde comprarlo.</p>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={recipe} onChange={(e) => setRecipe(e.target.value)} placeholder="Ej: lasaña de calabacín con pavo" maxLength={300} />
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Search />} Revisar</Button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {res && (
        <div className="mt-5 space-y-4">
          <h3 className="font-display text-lg font-bold">{res.recipeName}</h3>
          {res.have.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Ya tienes:</p>
              <ul className="flex flex-wrap gap-2">
                {res.have.map((h) => <li key={h} className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-sm text-primary"><Check className="h-3 w-3" />{h}</li>)}
              </ul>
            </div>
          )}
          {res.missing.length === 0 ? (
            <p className="text-primary">¡Tienes todo lo necesario! A cocinar.</p>
          ) : (
            <div>
              <p className="mb-2 text-sm font-medium">Te falta comprar:</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {res.missing.map((m) => (
                  <li key={m.ingredient} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{m.ingredient} <span className="text-sm text-muted-foreground">· {m.quantity}</span></p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-warm"><MapPin className="h-3.5 w-3.5" />{m.where}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{m.tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="rounded-lg bg-secondary p-3 text-sm">{res.fitnessNote}</p>
        </div>
      )}
    </section>
  );
}
