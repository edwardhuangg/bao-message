"use client";

import { createContext, useContext, useState } from "react";
import type { Profile } from "@/lib/supabase/types";

interface AppContextValue {
  userId: string;
  email: string;
  profile: Profile;
  setProfile: (p: Profile) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  userId,
  email,
  initialProfile,
  children,
}: {
  userId: string;
  email: string;
  initialProfile: Profile;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState(initialProfile);
  return (
    <AppContext.Provider value={{ userId, email, profile, setProfile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
