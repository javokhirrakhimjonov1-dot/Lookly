import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Gender } from "@/contexts/UserProfileContext";
import { isSupportedAge } from "@/lib/profileRules";
import type { HijabPreference } from "@/lib/modestyRules";

type SignUpProfile = {
  fullName: string;
  gender: Gender;
  age: number;
  hijabPreference: HijabPreference;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, profile: SignUpProfile) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updateEmail: (email: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return "Supabase is not configured yet.";
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string, profile: SignUpProfile) => {
    if (!supabase) return { error: "Supabase is not configured yet.", needsEmailConfirmation: false };
    if (!isSupportedAge(profile.age)) return { error: "Age must be from 12 to 50.", needsEmailConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: profile.fullName.trim(),
          gender: profile.gender,
          age: profile.age,
          hijab_preference: profile.gender === "female" ? profile.hijabPreference : null,
          onboarding_complete: true,
        },
      },
    });
    return { error: error?.message ?? null, needsEmailConfirmation: !data.session };
  };

  const signOut = async (): Promise<string | null> => {
    if (!supabase) return "Supabase is not configured yet.";
    const { error } = await supabase.auth.signOut();
    return error?.message ?? null;
  };

  const requestPasswordReset = async (email: string): Promise<string | null> => {
    if (!supabase) return "Supabase is not configured yet.";
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth?reset=1`
      : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return error?.message ?? null;
  };

  const updatePassword = async (password: string): Promise<string | null> => {
    if (!supabase) return "Supabase is not configured yet.";
    const { error } = await supabase.auth.updateUser({ password });
    return error?.message ?? null;
  };

  const updateEmail = async (email: string): Promise<{ error: string | null; needsConfirmation: boolean }> => {
    if (!supabase) return { error: "Supabase is not configured yet.", needsConfirmation: false };
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.updateUser({ email: normalizedEmail });
    return {
      error: error?.message ?? null,
      needsConfirmation: !error && data.user?.email?.toLowerCase() !== normalizedEmail,
    };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        requestPasswordReset,
        updateEmail,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
