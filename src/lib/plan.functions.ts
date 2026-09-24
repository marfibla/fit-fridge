import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  goal: z.enum(["perder", "mantener", "ganar"]),
  meal: z.enum(["comida", "cena"]),
  budget: z.number().min(0).max(1000).nullable(),
  store: z.string().max(40),
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
  shopping: z.array(z.object({ item: z.string(), quantity: z.string(), section: z.string(), price: z.number() })),
  supermarket: z.string(),
  totalPrice: z.number(),
  budgetNote: z.string(),
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
          "Eres nutricionista fitness y hablas español. Crea un plan semanal de 7 platos distintos (uno por día, de lunes a domingo) para una persona, variados y fáciles. Usa primero lo que hay en la nevera. En days, day = nombre del día, kcal y protein (gramos) son por ración. ingredients con cantidades. shopping = lista consolidada para toda la semana SOLO con lo que no hay en la nevera o no alcanza, con cantidades totales y section (Frutería, Carnicería, Pescadería, Lácteos, Despensa, Congelados...). Ignora sal, agua y aceite si es poca. tip = consejo corto. price = precio estimado en euros de cada producto en el supermercado indicado (precios realistas España 2026, marca blanca si hay presupuesto ajustado), totalPrice = suma. IMPORTANTE sobre precios: una compra semanal real para una persona en España cuesta APROXIMADAMENTE ENTRE 100 Y 150 €; calcula las cantidades y precios como una compra real de 7 días y el totalPrice debe quedar dentro de ese rango (o cerca de él). Nada de totales de 15-40 € que no cubrirían la semana. supermarket = SOLO el nombre del supermercado elegido, sin más texto (si es el más barato, elige tú el más económico: Mercadona, Lidl, Aldi, Dia, Carrefour...). El presupuesto que te den es ORIENTATIVO: si cabe dentro del rango realista, ajústate a él; si es muy bajo (por debajo de ~90 €), no recortes la compra a niveles irreales, mantén cantidades realistas y budgetNote explica que ese presupuesto es bajo para una semana completa y cuánto sobra o falta. budgetNote explica en una frase si cabe y cuánto sobra. Cantidades justas para exactamente 7 días, nada de más.",
        prompt: `Objetivo: ${goal}. Plato del día: ${data.meal}. Presupuesto semanal: ${data.budget ? data.budget + " €" : "sin límite"}. Supermercado: ${data.store}. Nevera: ${fridge}`,
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
