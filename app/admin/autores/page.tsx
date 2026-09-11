import type { Metadata } from "next";
import { AdminShell } from "../../../components/admin/AdminShell";
import { AuthorManager } from "../../../components/admin/AuthorManager";
import { getPortalDb } from "../../../lib/portal/db";
import { listAuthors } from "../../../lib/portal/queries";
import { requireAdmin } from "../../../lib/portal/session-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Autores", robots: { index: false } };

export default async function AuthorsAdminPage() {
  const session = await requireAdmin("/admin/autores");
  const db = await getPortalDb();

  return (
    <AdminShell user={session}>
      <div className="dm-admin-head">
        <h1>Autores</h1>
      </div>
      {db ? (
        <AuthorManager
          authors={(await listAuthors(db)).map((author) => ({
            id: author.id,
            name: author.name,
            bio: author.bio,
            email: author.email,
            avatarUrl: author.avatarUrl,
          }))}
        />
      ) : (
        <div className="dm-panel">Banco não conectado.</div>
      )}
    </AdminShell>
  );
}
