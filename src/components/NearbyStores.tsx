import { useState } from "react";
import { Loader2, LocateFixed, MapPin, Navigation, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Store = { id: number; name: string; type: string; lat: number; lon: number; dist: number; address?: string };

const TYPES: Record<string, string> = {
  supermarket: "Supermercado", convenience: "Tienda de barrio", greengrocer: "Frutería", butcher: "Carnicería",
  seafood: "Pescadería", health_food: "Herbolario / dietética", bakery: "Panadería", deli: "Charcutería", marketplace: "Mercado",
};

/** Guess which specialty shops fit the missing ingredients (from the "where" hints). */
function wantedTypes(hints: string[]) {
  const h = hints.join(" ").toLowerCase();
  const t = new Set(["supermarket", "marketplace"]);
  if (/fruter|verdur|fruta/.test(h)) t.add("greengrocer");
  if (/carnicer|carne/.test(h)) t.add("butcher");
  if (/pescad|marisc/.test(h)) t.add("seafood");
  if (/herbolar|dietét|ecológ|asiát|internacional/.test(h)) t.add("health_food");
  if (/panader|pan/.test(h)) t.add("bakery");
  if (t.size <= 3) t.add("convenience");
  return [...t];
}

function km(a: number, b: number, c: number, d: number) {
  const R = 6371, r = Math.PI / 180;
  const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function NearbyStores({ hints }: { hints: string[] }) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stores, setStores] = useState<Store[] | null>(null);

  const search = async (lat: number, lon: number) => {
    const types = wantedTypes(hints).join("|");
    const q = `[out:json][timeout:20];(nwr["shop"~"^(${types})$"](around:2000,${lat},${lon});nwr["amenity"="marketplace"](around:2000,${lat},${lon}););out center 60;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q) });
    if (!res.ok) throw new Error("overpass " + res.status);
    const json = (await res.json()) as { elements: { id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
    const list = json.elements
      .map((e) => {
        const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon, t = e.tags ?? {};
        if (la == null || lo == null) return null;
        const kind = t.amenity === "marketplace" ? "marketplace" : t.shop ?? "";
        const address = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
        return { id: e.id, name: t.name || t.brand || TYPES[kind] || "Tienda", type: TYPES[kind] ?? kind, lat: la, lon: lo, dist: km(lat, lon, la, lo), address };
      })
      .filter((s): s is Store => !!s)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 12);
    setStores(list);
  };

  const run = async (fn: () => Promise<void>) => {
    setLoading(true); setError(""); setStores(null);
    try { await fn(); } catch { setError("No se pudieron buscar tiendas ahora. Inténtalo de nuevo en unos segundos."); }
    setLoading(false);
  };

  const useLocation = () => {
    if (!navigator.geolocation) return setError("Tu navegador no permite compartir la ubicación. Escribe tu dirección.");
    setLoading(true); setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => run(() => search(p.coords.latitude, p.coords.longitude)),
      () => { setLoading(false); setError("No se pudo obtener tu ubicación. Permite el acceso o escribe tu dirección o ciudad."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const byAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim().length < 3) return;
    run(async () => {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address.trim())}`, { headers: { "Accept-Language": "es" } });
      const [hit] = (await r.json()) as { lat: string; lon: string }[];
      if (!hit) throw new Error("not found");
      await search(parseFloat(hit.lat), parseFloat(hit.lon));
    });
  };

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 flex items-center gap-2 font-medium"><MapPin className="h-4 w-4 text-warm" /> Busca tiendas cerca de ti</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={useLocation} disabled={loading}><LocateFixed /> Usar mi ubicación</Button>
        <form onSubmit={byAddress} className="flex flex-1 gap-2">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="O escribe tu dirección o ciudad" maxLength={150} />
          <Button type="submit" disabled={loading} aria-label="Buscar">{loading ? <Loader2 className="animate-spin" /> : <Search />}</Button>
        </form>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {stores && stores.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No hemos encontrado tiendas a menos de 2 km. Prueba con otra dirección.</p>}
      {stores && stores.length > 0 && (
        <ul className="mt-4 space-y-2">
          {stores.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.type}{s.address ? ` · ${s.address}` : ""}</p>
              </div>
              <span className="whitespace-nowrap text-sm text-primary">{s.dist < 1 ? `${Math.round(s.dist * 1000)} m` : `${s.dist.toFixed(1)} km`}</span>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`} target="_blank" rel="noreferrer" aria-label={`Cómo llegar a ${s.name}`}
                className="rounded-md bg-primary p-2 text-primary-foreground"><Navigation className="h-4 w-4" /></a>
            </li>
          ))}
          <li className="pt-1 text-xs text-muted-foreground">Datos de tiendas de OpenStreetMap. Confirma el horario antes de ir.</li>
        </ul>
      )}
    </div>
  );
}
