import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export const UPCOMING_FEATURES = [
  "squad_votes",
  "premium_try_on",
  "shop_missing_pieces",
] as const;

export type UpcomingFeature = (typeof UPCOMING_FEATURES)[number];

type FeatureWaitlistContextValue = {
  joinedFeatures: Set<UpcomingFeature>;
  isLoading: boolean;
  updatingFeature: UpcomingFeature | null;
  toggleWaitlist: (feature: UpcomingFeature) => Promise<string | null>;
};

const FeatureWaitlistContext = createContext<FeatureWaitlistContextValue | null>(null);

export function FeatureWaitlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [joinedFeatures, setJoinedFeatures] = useState<Set<UpcomingFeature>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [updatingFeature, setUpdatingFeature] = useState<UpcomingFeature | null>(null);

  useEffect(() => {
    let active = true;
    if (!user || !supabase) {
      setJoinedFeatures(new Set());
      setIsLoading(false);
      return () => { active = false; };
    }

    setIsLoading(true);
    void supabase
      .from("feature_waitlist")
      .select("feature_key")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn("Could not load feature waitlist", error.message);
          setJoinedFeatures(new Set());
        } else {
          const valid = new Set(
            (data ?? [])
              .map((entry) => entry.feature_key)
              .filter((feature): feature is UpcomingFeature =>
                UPCOMING_FEATURES.includes(feature as UpcomingFeature),
              ),
          );
          setJoinedFeatures(valid);
        }
        setIsLoading(false);
      });

    return () => { active = false; };
  }, [user?.id]);

  const toggleWaitlist = useCallback(async (feature: UpcomingFeature): Promise<string | null> => {
    if (!user || !supabase) return "Please sign in before joining the waitlist.";
    if (updatingFeature) return null;

    const isJoined = joinedFeatures.has(feature);
    setUpdatingFeature(feature);
    try {
      const { error } = isJoined
        ? await supabase.from("feature_waitlist").delete().eq("user_id", user.id).eq("feature_key", feature)
        : await supabase.from("feature_waitlist").insert({ user_id: user.id, feature_key: feature });

      if (error) return "The waitlist is not ready yet. Please try again shortly.";

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
