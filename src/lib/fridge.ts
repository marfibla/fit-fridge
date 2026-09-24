export type Category = "Proteína" | "Verdura" | "Fruta" | "Lácteo" | "Cereal" | "Otro";
export type Item = { id: string; name: string; qty: string; category: Category; expires: string; added: string };

const KEY = "fitfridge-items";
const NOTIFIED = "fitfridge-notified";

export function loadItems(): Item[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveItems(items: Item[]) { localStorage.setItem(KEY, JSON.stringify(items)); }

export function daysLeft(expires: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(expires + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function expiryLabel(n: number) {
  if (n < 0) return `Caducó hace ${-n} día${n === -1 ? "" : "s"}`;
  if (n === 0) return "Caduca hoy";
  if (n === 1) return "Caduca mañana";
  return `Caduca en ${n} días`;
}

/** Sends one browser notification per item per day when it expires within 2 days. */
export function notifyExpiring(items: Item[]): Item[] {
  const soon = items.filter((i) => daysLeft(i.expires) <= 2).sort((a, b) => a.expires.localeCompare(b.expires));
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return soon;
  const today = new Date().toISOString().slice(0, 10);
  let sent: Record<string, string> = {};
  try { sent = JSON.parse(localStorage.getItem(NOTIFIED) || "{}"); } catch { /* empty */ }
  for (const i of soon) {
    if (sent[i.id] === today) continue;
    try {
      new Notification("FitFridge: " + i.name, { body: expiryLabel(daysLeft(i.expires)) + ". ¡Úsalo en una receta!" });
    } catch { /* unsupported */ }
    sent[i.id] = today;
  }
  localStorage.setItem(NOTIFIED, JSON.stringify(sent));
  return soon;
}

export type Recipe = { name: string; kcal: number; protein: number; needs: string[]; steps: string };
export const RECIPES: Recipe[] = [
  { name: "Tortilla de claras con espinacas", kcal: 220, protein: 26, needs: ["huevo", "espinaca"], steps: "Bate las claras, saltea las espinacas y cuaja a fuego medio." },
  { name: "Bowl de pollo y arroz integral", kcal: 480, protein: 42, needs: ["pollo", "arroz"], steps: "Cuece el arroz, plancha el pollo en tiras y sirve con verduras." },
  { name: "Yogur griego con avena y fruta", kcal: 320, protein: 22, needs: ["yogur", "avena"], steps: "Mezcla yogur, avena y fruta troceada. Listo." },
  { name: "Salmón al horno con brócoli", kcal: 450, protein: 38, needs: ["salmón", "brócoli"], steps: "Hornea 15 min a 200 °C con limón y aceite de oliva." },
  { name: "Ensalada de atún y tomate", kcal: 300, protein: 30, needs: ["atún", "tomate"], steps: "Combina atún, tomate, lechuga y un chorrito de aceite." },
  { name: "Batido de plátano y leche", kcal: 280, protein: 18, needs: ["plátano", "leche"], steps: "Tritura plátano, leche y una cucharada de crema de cacahuete." },
  { name: "Pavo salteado con pimiento", kcal: 350, protein: 35, needs: ["pavo", "pimiento"], steps: "Saltea tiras de pavo con pimiento y cebolla, especia al gusto." },
  { name: "Revuelto de huevo y tomate", kcal: 260, protein: 18, needs: ["huevo", "tomate"], steps: "Sofríe el tomate y añade los huevos batidos removiendo." },
];

export function suggest(items: Item[]) {
  const names = items.map((i) => i.name.toLowerCase());
  const has = (n: string) => names.some((x) => x.includes(n) || n.includes(x.replace(/s$/, "")));
  return RECIPES.map((r) => {
    const matched = r.needs.filter(has);
    const urgent = items.some((i) => daysLeft(i.expires) <= 2 && r.needs.some((n) => i.name.toLowerCase().includes(n)));
    return { ...r, matched, missing: r.needs.filter((n) => !has(n)), urgent };
  })
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.matched.length - a.matched.length);
}
