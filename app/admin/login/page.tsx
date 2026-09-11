import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "../../../components/admin/LoginForm";
import { needsBootstrapAdmin } from "../../../lib/portal/auth";
import { currentAdmin } from "../../../lib/portal/session-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  if (await currentAdmin()) redirect("/admin");

  const { return_to: returnTo } = await searchParams;
  const safeReturn = returnTo?.startsWith("/admin") ? returnTo : "/admin";

  return <LoginForm needsSetup={await needsBootstrapAdmin()} returnTo={safeReturn} />;
}
