"use client";

import { createContext, useContext } from "react";

export type SessionUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("Sessão autenticada não encontrada.");
  return user;
}
