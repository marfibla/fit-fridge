import { useRef, useState } from "react";
import { Camera, Loader2, ScanBarcode, CalendarCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CATS, CAT_EMOJI, type Category, type Item } from "@/lib/fridge";
import { scanProduct } from "@/lib/scan.functions";

async function toDataUrl(file: File, max = 1280): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

type Detector = { detect: (s: ImageBitmap) => Promise<{ rawValue: string }[]> };
async function readCode(file: File): Promise<string | null> {
  const BD = (window as unknown as { BarcodeDetector?: new () => Detector }).BarcodeDetector;
  if (!BD) return null;
  try { const r = await new BD().detect(await createImageBitmap(file)); return r[0]?.rawValue ?? null; } catch { return null; }
}

async function lookup(code: string): Promise<string | null> {
  if (!/^\d{8,14}$/.test(code)) return null;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,quantity`);
    const j = await r.json();
    const p = j?.product;
    return p?.product_name ? [p.product_name, p.brands, p.quantity].filter(Boolean).join(" · ") : null;
  } catch { return null; }
}

function PhotoSlot({ label, hint, icon: Icon, preview, onFile }: { label: string; hint: string; icon: typeof Camera; preview?: string | undefined; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button type="button" onClick={() => ref.current?.click()}
      className="relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-dashed border-primary/50 bg-primary/5 p-2 text-center text-sm">
      {preview ? <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover" /> : <>
        <Icon className="size-7 text-primary" /><span className="font-semibold">{label}</span><span className="text-xs text-muted-foreground">{hint}</span>
      </>}
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </button>
  );
}

export function ScanDialog({ onAdd }: { onAdd: (i: Item) => void }) {
  const scan = useServerFn(scanProduct);
  const [open, setOpen] = useState(false);
  const [codeImg, setCodeImg] = useState<string>();
  const [dateImg, setDateImg] = useState<string>();
  const [barcodeName, setBarcodeName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [units, setUnits] = useState(1);
  const [category, setCategory] = useState<Category>("Otro");
  const [expires, setExpires] = useState("");

  const reset = () => { setCodeImg(undefined); setDateImg(undefined); setBarcodeName(null); setReady(false); setName(""); setSize(""); setUnits(1); setExpires(""); setCategory("Otro"); };

  const onCode = async (f: File) => {
    setCodeImg(await toDataUrl(f));
    const code = await readCode(f);
    if (code) { const n = await lookup(code); setBarcodeName(n); if (n) toast.success(`Código leído: ${n}`); }
  };

  const analyze = async () => {
    const images = [codeImg, dateImg].filter(Boolean) as string[];
    if (!images.length) return;
    setBusy(true);
    try {
      const r = await scan({ data: { images, barcodeName, today: new Date().toISOString().slice(0, 10) } });
      if (r.error || !r.result) { toast.error(r.error ?? "No se pudo leer"); return; }
      const x = r.result;
      setName(x.name); setSize(x.size); setCategory(x.category);
      setExpires(/^\d{4}-\d{2}-\d{2}$/.test(x.expires) ? x.expires : "");
      if (!x.expiryFound) toast.message("No he visto la fecha: añádela tú o haz foto a la fecha impresa.");
      setReady(true);
    } finally { setBusy(false); }
  };

  const save = () => {
    if (!name.trim() || !expires) { toast.error("Falta el nombre o la fecha de caducidad"); return; }
    const qty = units > 1 ? `${units} uds${size ? ` × ${size}` : ""}` : size;
    onAdd({ id: crypto.randomUUID(), name: name.trim(), qty, category, expires, added: new Date().toISOString(), level: 3 });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button size="lg" variant="outline"><ScanBarcode /> Escanear</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Escanear producto</DialogTitle></DialogHeader>
        {!ready ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <PhotoSlot label="1. Código" hint="Barras o QR" icon={ScanBarcode} preview={codeImg} onFile={onCode} />
              <PhotoSlot label="2. Fecha" hint="Caducidad impresa" icon={CalendarCheck} preview={dateImg} onFile={async (f) => setDateImg(await toDataUrl(f))} />
            </div>
            {barcodeName && <p className="text-sm text-primary">✓ {barcodeName}</p>}
            <p className="text-xs text-muted-foreground">Si el QR ya incluye la fecha, basta con la primera foto.</p>
            <Button className="w-full" disabled={busy || (!codeImg && !dateImg)} onClick={analyze}>
              {busy ? <><Loader2 className="animate-spin" /> Leyendo…</> : <><Camera /> Leer producto</>}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label htmlFor="sn">Producto</Label><Input id="sn" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="su">Unidades compradas</Label>
                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="outline" onClick={() => setUnits((u) => Math.max(1, u - 1))}>−</Button>
                  <Input id="su" type="number" min={1} className="text-center" value={units} onChange={(e) => setUnits(Math.max(1, Number(e.target.value) || 1))} />
                  <Button type="button" size="icon" variant="outline" onClick={() => setUnits((u) => u + 1)}>+</Button>
                </div>
              </div>
              <div><Label htmlFor="ss">Tamaño</Label><Input id="ss" value={size} onChange={(e) => setSize(e.target.value)} placeholder="1,5 L" /></div>
            </div>
            <div><Label htmlFor="se">Caduca el</Label><Input id="se" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-2">
              {CATS.map((c) => (
                <button type="button" key={c} onClick={() => setCategory(c)}
                  className={`rounded-lg border px-2 py-2 text-sm ${category === c ? "border-primary bg-primary/15" : "border-border"}`}>{CAT_EMOJI[c]} {c}</button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={reset}>Escanear otro</Button>
              <Button className="flex-1" onClick={() => { save(); }}>Guardar en la nevera</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
