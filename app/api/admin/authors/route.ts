import { authors } from "../../../../db/schema";
import { sessionFromRequest, unauthorized } from "../../../../lib/portal/auth";
import { getPortalDb } from "../../../../lib/portal/db";
import { listAuthors } from "../../../../lib/portal/queries";
import { slugify } from "../../../../lib/portal/slug";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });
  return Response.json({ authors: await listAuthors(db) });
}

export async function POST(request: Request) {
  if (!(await sessionFromRequest(request))) return unauthorized();
  const db = await getPortalDb();
  if (!db) return Response.json({ error: "Banco não conectado." }, { status: 503 });

  const body = (await request.json()) as {
    name?: string;
    bio?: string;
    email?: string;
    avatarUrl?: string;
  };
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ error: "Informe o nome do autor." }, { status: 400 });

  const author = {
    id: crypto.randomUUID(),
    name,
    slug: slugify(name),
    bio: body.bio?.trim() || null,
    email: body.email?.trim() || null,
    avatarUrl: body.avatarUrl?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  try {
    await db.insert(authors).values(author);
  } catch {
    return Response.json({ error: "Já existe um autor com esse nome." }, { status: 409 });
  }
  return Response.json({ ok: true, author }, { status: 201 });
}
