import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export const UPCOMING_FEATURES = [
  "squad_votes",
  "premium_try_on",
  "shop_missing_pieces",
  "deal_notifications",
  "privacy_controls",
] as const;

export type UpcomingFeature = (typeof UPCOMING_FEATURES)[number];

type FeatureWaitlistContextValue = {
  joinedFeatures: Set<UpcomingFeature>;
  isLoading: boolean;
  updatingFeature: UpcomingFeature | null;
  toggleWaitlist: (feature: UpcomingFeature) => Promise<string | null>;
};

const FeatureWaitlistContext = createContext<FeatureWaitlistContextValue | null>(null);

function isFutureIssuedJwtError(error: { message?: string } | null): boolean {
  return /jwt.*issued at future|issued at future/i.test(error?.message ?? "");
}

async function refreshFutureIssuedSession(error: { message?: string } | null): Promise<boolean> {
  if (!supabase || !isFutureIssuedJwtError(error)) return false;
  const { error: refreshError } = await supabase.auth.refreshSession();
  return !refreshError;
}

export function FeatureWaitlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [joinedFeatures, setJoinedFeatures] = useState<Set<UpcomingFeature>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [updatingFeature, setUpdatingFeature] = useState<UpcomingFeature | null>(null);

  useEffect(() => {
    let active = true;
    const client = supabase;
    if (!user || !client) {
      setJoinedFeatures(new Set());
      setIsLoading(false);
      return () => { active = false; };
    }

    setIsLoading(true);
    void (async () => {
      const load = () => client
        .from("feature_waitlist")
        .select("feature_key")
        .eq("user_id", user.id);

      let result = await load();
      if (await refreshFutureIssuedSession(result.error)) result = await load();
      if (!active) return;

      if (result.error) {
        console.warn("Could not load feature waitlist", result.error.message);
        setJoinedFeatures(new Set());
      } else {
        const valid = new Set(
          (result.data ?? [])
            .map((entry) => entry.feature_key)
            .filter((feature): feature is UpcomingFeature =>
              UPCOMING_FEATURES.includes(feature as UpcomingFeature),
            ),
        );
        setJoinedFeatures(valid);
      }
      setIsLoading(false);
    })();

    return () => { active = false; };
  }, [user?.id]);

  const toggleWaitlist = useCallback(async (feature: UpcomingFeature): Promise<string | null> => {
    const client = supabase;
    if (!user || !client) return "Please sign in before joining the waitlist.";
    if (updatingFeature) return null;

    const isJoined = joinedFeatures.has(feature);
    setUpdatingFeature(feature);
    try {
      const mutate = () => isJoined
        ? client.from("feature_waitlist").delete().eq("user_id", user.id).eq("feature_key", feature)
        : client.from("feature_waitlist").insert({ user_id: user.id, feature_key: feature });

      let result = await mutate();
      if (await refreshFutureIssuedSession(result.error)) result = await mutate();

      if (result.error) return "The waitlist is not ready yet. Please try again shortly.";

      setJoinedFeatures((current) => {
        const next = new Set(current);
        if (isJoined) next.delete(feature);
        else next.add(feature);
        return next;
      });
      return null;
    } finally {
      setUpdatingFeature(null);
    }
  }, [joinedFeatures, updatingFeature, user]);

  return (
    <FeatureWaitlistContext.Provider value={{ joinedFeatures, isLoading, updatingFeature, toggleWaitlist }}>
      {children}
    </FeatureWaitlistContext.Provider>
  );
}

export function useFeatureWaitlist() {
  const context = useContext(FeatureWaitlistContext);
  if (!context) throw new Error("useFeatureWaitlist must be used inside FeatureWaitlistProvider");
  return context;
}
