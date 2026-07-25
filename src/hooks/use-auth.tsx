import { createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/status";

interface Profile {
  id: string;
  full_name: string;
  avatar_color_hex: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (r: AppRole) => boolean;
  isManager: boolean;
  isAdmin: boolean;
  isLeadership: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Mock guest profile — authentication is disabled; dashboard is always accessible.
const GUEST_PROFILE: Profile = {
  id: "guest",
  full_name: "Guest User",
  avatar_color_hex: "#6366f1",
};

const GUEST_ROLES: AppRole[] = ["admin", "manager"];

const GUEST_VALUE: AuthContextValue = {
  session: null,
  user: null,
  profile: GUEST_PROFILE,
  roles: GUEST_ROLES,
  loading: false,
  hasRole: (r) => GUEST_ROLES.includes(r),
  isManager: true,
  isAdmin: true,
  isLeadership: true,
  refresh: async () => {},
  signOut: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={GUEST_VALUE}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}