import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureRuntimeSchema, getRuntimeDb, persistencePendingResponse } from "../../../db/runtime";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "AUTH_REQUIRED", error: "Faça login para salvar a simulação." }, { status: 401 });
  const db = await getRuntimeDb();
  if (!db) return persistencePendingResponse();
  const payload = await request.json() as Record<string, unknown>;
  const platform = typeof payload.platform === "string" ? payload.platform : "marketplace";
  const values = ["cost", "margin", "fee", "fixed", "shipping", "recommendedPrice", "net", "profit"] as const;
  const numbers = values.map((key) => typeof payload[key] === "number" && Number.isFinite(payload[key]) ? payload[key] as number : NaN);
  if (numbers.some((value) => !Number.isFinite(value))) return Response.json({ code: "PRICING_DATA_INVALID", error: "Informe valores numéricos válidos para salvar a simulação." }, { status: 400 });
  try {
    await ensureRuntimeSchema(db);
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO pricing_simulations (id, created_by, platform, cost, margin, fee, fixed, shipping, recommended_price, net, profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, user.email, platform, ...numbers).run();
    return Response.json({ saved: true, id }, { status: 201 });
  } catch {
    return Response.json({ code: "PERSISTENCE_ERROR", error: "Não foi possível salvar a simulação de preço." }, { status: 500 });
  }
}
