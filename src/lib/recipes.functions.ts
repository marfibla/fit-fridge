import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  fridge: z.array(z.object({ name: z.string().max(100), qty: z.string().max(50), expiresInDays: z.number() })).min(1).max(200),
  goal: z.enum(["perder", "mantener", "ganar"]),
  meal: z.enum(["cualquiera", "desayuno", "comida", "cena", "snack"]),
});

const Recipe = z.object({
  name: z.string(),
  meal: z.string(),
  minutes: z.number(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  usesExpiring: z.boolean(),
  ingredients: z.array(z.object({ item: z.string(), amount: z.string(), inFridge: z.boolean() })),
  steps: z.array(z.string()),
});
const Result = z.object({ recipes: z.array(Recipe) });
export type AIRecipe = z.infer<typeof Recipe>;

export const generateRecipes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ recipes?: AIRecipe[]; error?: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "Falta la configuración de la IA." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const goal = { perder: "perder grasa (déficit calórico, mucha proteína)", mantener: "mantener peso equilibrado", ganar: "ganar músculo (superávit, mucha proteína)" }[data.goal];
    const fridge = data.fridge.map((i) => `- ${i.name}${i.qty ? ` (${i.qty})` : ""}, caduca en ${i.expiresInDays} días`).join("\n");
    try {
      const r = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: Result }),
        system:
          "Eres un nutricionista y chef fitness. Responde en español. Crea 4 recetas saludables y realistas usando sobre todo lo que hay en la nevera; puedes asumir básicos de despensa (sal, especias, aceite de oliva, agua). Prioriza los productos que caducan antes (usesExpiring=true si usa alguno que caduca en ≤3 días). Macros por ración estimadas y coherentes. Pasos cortos y claros. Los básicos de despensa (sal, pimienta, especias, aceite, agua) cuentan como inFridge=true. Marca inFridge=false solo para otros ingredientes que no están en la nevera (máximo 2 por receta).",
        prompt: `Objetivo: ${goal}\nTipo de comida: ${data.meal}\nNevera:\n${fridge}`,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] } },
      });
      return { recipes: (await r.output).recipes };
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("generateRecipes failed", status, e);
      if (status === 402) return { error: "Se han agotado los créditos de IA. Añade más en Ajustes → Planes y créditos." };
      if (status === 429) return { error: "Demasiadas consultas. Espera un momento y vuelve a probar." };
      return { error: "No se pudieron generar recetas. Inténtalo de nuevo." };
    }
  });
