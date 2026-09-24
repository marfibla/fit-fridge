import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  goal: z.enum(["perder", "mantener", "ganar"]),
  meal: z.enum(["comida", "cena"]),
  fridge: z.array(z.object({ name: z.string().max(100), qty: z.string().max(50) })).max(200),
});

const Plan = z.object({
  days: z.array(z.object({
    day: z.string(),
    name: z.string(),
    description: z.string(),
    kcal: z.number(),
    protein: z.number(),
    ingredients: z.array(z.string()),
  })),
  shopping: z.array(z.object({ item: z.string(), quantity: z.string(), section: z.string() })),
  tip: z.string(),
});
export type WeekPlan = z.infer<typeof Plan>;

export const generateWeekPlan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ plan?: WeekPlan; error?: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "Falta la configuración de la IA." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const goal = { perder: "perder grasa (platos ligeros, ~450-550 kcal)", mantener: "mantener peso (~550-700 kcal)", ganar: "ganar músculo (alta proteína, ~700-900 kcal)" }[data.goal];
    const fridge = data.fridge.map((i) => `${i.name}${i.qty ? ` (${i.qty})` : ""}`).join(", ") || "vacía";
    try {
      const r = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: Plan }),
        system:
          "Eres nutricionista fitness y hablas español. Crea un plan semanal de 7 platos distintos (uno por día, de lunes a domingo) para una persona, variados y fáciles. Usa primero lo que hay en la nevera. En days, day = nombre del día, kcal y protein (gramos) son por ración. ingredients con cantidades. shopping = lista consolidada para toda la semana SOLO con lo que no hay en la nevera o no alcanza, con cantidades totales y section (Frutería, Carnicería, Pescadería, Lácteos, Despensa, Congelados...). Ignora sal, agua y aceite si es poca. tip = consejo corto.",
        prompt: `Objetivo: ${goal}. Plato del día: ${data.meal}. Nevera: ${fridge}`,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] } },
      });
      return { plan: await r.output };
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("plan failed", status, e);
      if (status === 402) return { error: "Se han agotado los créditos de IA. Añade más en Ajustes → Planes y créditos." };
      if (status === 429) return { error: "Demasiadas consultas. Espera un momento y vuelve a probar." };
      return { error: "No se pudo crear el plan. Inténtalo de nuevo." };
    }
  });
