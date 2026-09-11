import type { Metadata } from "next";
import { AdminShell } from "../../../components/admin/AdminShell";
import { CategoryManager } from "../../../components/admin/CategoryManager";
import { getPortalDb } from "../../../lib/portal/db";
import { listCategories } from "../../../lib/portal/queries";
import { requireAdmin } from "../../../lib/portal/session-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Editorias", robots: { index: false } };

export default async function CategoriesAdminPage() {
  const session = await requireAdmin("/admin/editorias");
  const db = await getPortalDb();

  return (
    <AdminShell user={session}>
      <div className="dm-admin-head">
        <h1>Editorias</h1>
      </div>
      {db ? (
        <CategoryManager
          categories={(await listCategories(db)).map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            color: category.color,
            position: category.position,
          }))}
        />
      ) : (
        <div className="dm-panel">Banco não conectado.</div>
      )}
    </AdminShell>
  );
}
