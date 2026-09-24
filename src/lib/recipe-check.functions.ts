import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  recipe: z.string().trim().min(2).max(300),
  fridge: z.array(z.object({ name: z.string().max(100), qty: z.string().max(50) })).max(200),
});

const Result = z.object({
  recipeName: z.string(),
  have: z.array(z.string()),
  missing: z.array(z.object({ ingredient: z.string(), quantity: z.string(), where: z.string(), tip: z.string() })),
  fitnessNote: z.string(),
});

export type RecipeCheck = z.infer<typeof Result>;

export const checkRecipe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ result?: RecipeCheck; error?: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "Falta la configuración de la IA." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const fridge = data.fridge.map((i) => `${i.name}${i.qty ? ` (${i.qty})` : ""}`).join(", ") || "vacía";
    try {
      const r = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: Result }),
        system:
          "Eres un asistente de cocina fitness en español. Dada una receta y el contenido de la nevera, lista los ingredientes que ya tiene (have) y los que le faltan (missing). Para cada ingrediente que falta indica cantidad aproximada, dónde comprarlo (tipo de tienda o sección concreta: supermercado - sección frutería, carnicería, pescadería, herbolario, tienda de dietética, tienda asiática, etc.) y un consejo breve de compra saludable. Ignora básicos como sal, agua. Añade una nota fitness corta (calorías/proteína aproximadas).",
        prompt: `Receta: ${data.recipe}\nNevera: ${fridge}`,
        providerOptions: {
          openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] },
        },
      });
      return { result: await r.output };
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("recipe check failed", status, e);
      if (status === 402) return { error: "Se han agotado los créditos de IA. Añade más en Ajustes → Planes y créditos." };
      if (status === 429) return { error: "Demasiadas consultas. Espera un momento y vuelve a probar." };
      return { error: "No se pudo analizar la receta. Inténtalo de nuevo." };
    }
  });
