import { useCallback, useEffect, useState } from "react";

export type Category = "Proteína" | "Verdura" | "Fruta" | "Lácteo" | "Cereal" | "Otro";
export const CATS: Category[] = ["Proteína", "Lácteo", "Verdura", "Fruta", "Cereal", "Otro"];
export const CAT_EMOJI: Record<Category, string> = { Proteína: "🍗", Lácteo: "🥛", Verdura: "🥦", Fruta: "🍎", Cereal: "🌾", Otro: "🫙" };

/** level: 0 = agotado, 1 = queda poco, 2 = medio, 3 = lleno */
export type Item = { id: string; name: string; qty: string; category: Category; expires: string; added: string; level: number };
export type ShopItem = { id: string; name: string; done: boolean };

const KEY = "fitfridge-items";
const SHOP = "fitfridge-shop";
const NOTIFIED = "fitfridge-notified";
const EVT = "fitfridge-change";

const EMOJI: [string, string][] = [
  ["pollo", "🍗"], ["pavo", "🦃"], ["ternera", "🥩"], ["carne", "🥩"], ["salm", "🐟"], ["atún", "🐟"], ["pescado", "🐟"], ["gamba", "🦐"],
  ["huevo", "🥚"], ["leche", "🥛"], ["yogur", "🥣"], ["queso", "🧀"], ["mantequilla", "🧈"], ["tofu", "🧊"],
  ["tomate", "🍅"], ["lechuga", "🥬"], ["espinaca", "🥬"], ["brócoli", "🥦"], ["zanahoria", "🥕"], ["pimiento", "🫑"], ["cebolla", "🧅"], ["ajo", "🧄"], ["patata", "🥔"], ["calabac", "🥒"], ["pepino", "🥒"], ["aguacate", "🥑"], ["champi", "🍄"], ["maíz", "🌽"],
  ["plátano", "🍌"], ["manzana", "🍎"], ["naranja", "🍊"], ["limón", "🍋"], ["fresa", "🍓"], ["uva", "🍇"], ["pera", "🍐"], ["piña", "🍍"], ["sandía", "🍉"], ["arándano", "🫐"],
  ["arroz", "🍚"], ["pan", "🍞"], ["pasta", "🍝"], ["avena", "🥣"], ["quinoa", "🌾"], ["legumbre", "🫘"], ["garbanzo", "🫘"], ["lenteja", "🫘"], ["nuez", "🥜"], ["cacahuete", "🥜"],
];
export const emojiFor = (i: Pick<Item, "name" | "category">) => {
  const n = i.name.toLowerCase();
  return EMOJI.find(([k]) => n.includes(k))?.[1] ?? CAT_EMOJI[i.category];
};

function read<T>(k: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { return JSON.parse(localStorage.getItem(k) || "null") ?? fb; } catch { return fb; }
}
function write(k: string, v: unknown) { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event(EVT)); }

/** Shared store across pages (localStorage + change event). */
export function useFridge() {
  const [items, setItemsState] = useState<Item[]>([]);
  const [shop, setShopState] = useState<ShopItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => {
      setItemsState(read<Item[]>(KEY, []).map((i) => ({ ...i, level: i.level ?? 3 })));
      setShopState(read<ShopItem[]>(SHOP, []));
    };
    sync(); setReady(true);
    window.addEventListener(EVT, sync); window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const setItems = useCallback((fn: (p: Item[]) => Item[]) => write(KEY, fn(read<Item[]>(KEY, []))), []);
  const setShop = useCallback((fn: (p: ShopItem[]) => ShopItem[]) => write(SHOP, fn(read<ShopItem[]>(SHOP, []))), []);
  const addToShop = useCallback((name: string) => setShop((p) =>
    p.some((s) => !s.done && s.name.toLowerCase() === name.toLowerCase()) ? p : [...p, { id: crypto.randomUUID(), name, done: false }]), [setShop]);
  return { items, shop, ready, setItems, setShop, addToShop };
}

export function daysLeft(expires: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(expires + "T00:00:00").getTime() - today.getTime()) / 86400000);
}
export function expiryLabel(n: number) {
  if (n < 0) return `Caducó hace ${-n} día${n === -1 ? "" : "s"}`;
  if (n === 0) return "Caduca hoy";
  if (n === 1) return "Caduca mañana";
  return `Caduca en ${n} días`;
}
export const LEVEL_LABEL = ["Agotado", "Queda poco", "A la mitad", "Lleno"];
export const isLow = (i: Item) => i.level <= 1;
export const isExpiring = (i: Item) => daysLeft(i.expires) <= 2;

/** Básicos fitness: avisa si no hay ninguno de cada grupo. */
export const ESSENTIALS: { label: string; match: string[] }[] = [
  { label: "Huevos", match: ["huevo"] },
  { label: "Proteína magra (pollo, pavo, pescado)", match: ["pollo", "pavo", "salm", "atún", "pescado", "ternera", "tofu"] },
  { label: "Verdura fresca", match: ["espinaca", "brócoli", "lechuga", "tomate", "calabac", "pimiento", "zanahoria"] },
  { label: "Fruta", match: ["plátano", "manzana", "fresa", "naranja", "arándano", "pera", "kiwi"] },
  { label: "Hidrato integral (arroz, avena, pasta)", match: ["arroz", "avena", "pasta", "quinoa", "pan"] },
  { label: "Lácteo proteico (yogur griego, queso fresco)", match: ["yogur", "queso", "kéfir", "leche"] },
];
export function missingEssentials(items: Item[]) {
  const names = items.filter((i) => i.level > 0).map((i) => i.name.toLowerCase());
  return ESSENTIALS.filter((e) => !e.match.some((m) => names.some((n) => n.includes(m))));
}

/** One browser notification per item per day for expiring or low stock. */
export function notifyAlerts(items: Item[]) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const today = new Date().toISOString().slice(0, 10);
  const sent = read<Record<string, string>>(NOTIFIED, {});
  const send = (key: string, title: string, body: string) => {
    if (sent[key] === today) return;
    try { new Notification(title, { body, icon: "/favicon.ico" }); } catch { /* unsupported */ }
    sent[key] = today;
  };
  for (const i of items) {
    if (isExpiring(i)) send("exp-" + i.id, "FitFridge · " + i.name, expiryLabel(daysLeft(i.expires)) + ". ¡Úsalo hoy!");
    if (isLow(i)) send("low-" + i.id, "FitFridge · te falta comida", `${i.name}: ${LEVEL_LABEL[i.level].toLowerCase()}. Añádelo a la compra.`);
  }
  const miss = missingEssentials(items);
  if (items.length && miss.length) send("ess", "FitFridge · faltan básicos", "No tienes: " + miss.map((m) => (m.label.split(" (")[0] ?? m.label)).join(", "));
  localStorage.setItem(NOTIFIED, JSON.stringify(sent));
}
