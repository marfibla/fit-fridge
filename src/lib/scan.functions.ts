import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DataUrl = z.string().startsWith("data:image/").max(4_000_000);
const Input = z.object({
  images: z.array(DataUrl).min(1).max(2),
  barcodeName: z.string().max(200).nullable(),
  today: z.string().max(10),
});

const Result = z.object({
  name: z.string(),
  size: z.string(),
  category: z.enum(["Proteína", "Verdura", "Fruta", "Lácteo", "Cereal", "Otro"]),
  expires: z.string(),
  expiryFound: z.boolean(),
});
export type ScanResult = z.infer<typeof Result>;

export const scanProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ result?: ScanResult; error?: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "Falta la configuración de la IA." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const r = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: Result }),
        system:
          `Analizas fotos de productos de supermercado (código de barras, QR, etiqueta o fecha impresa). Hoy es ${data.today}. Devuelve: name = nombre corto del producto en español (marca opcional); size = tamaño por unidad si se ve (ej. "1,5 L", "500 g") o ""; category; expires = fecha de caducidad o consumo preferente en formato YYYY-MM-DD (si solo hay mes/año usa el último día del mes; si un QR GS1 contiene la fecha, úsala) o "" si no se ve; expiryFound indica si has leído la fecha.`,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: data.barcodeName ? `El código de barras corresponde a: ${data.barcodeName}` : "Identifica el producto." },
            ...data.images.map((u) => ({ type: "image" as const, image: new URL(u) })),
          ],
        }],
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      return { result: await r.output };
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("scan failed", status, e);
      if (status === 402) return { error: "Se han agotado los créditos de IA. Añade más en Ajustes → Planes y créditos." };
      if (status === 429) return { error: "Demasiadas consultas. Espera un momento y vuelve a probar." };
      return { error: "No se pudo leer la foto. Prueba con otra más nítida." };
    }
  });
