import type { Gender, StylingPreferences } from "@/contexts/UserProfileContext";

/** Female-only styling choices must not remain active after a profile changes
 * gender. Store-recommendation exclusions are intentionally profile-wide. */
export function normalizeStylingPreferencesForGender(
  gender: Gender | null | undefined,
  preferences?: Partial<StylingPreferences> | null,
): StylingPreferences {
  const merged: StylingPreferences = {
    coverage: preferences?.coverage ?? "no_preference",
    silhouette: preferences?.silhouette ?? "balanced",
    heels: preferences?.heels ?? "any",
    hijabPreference: preferences?.hijabPreference ?? null,
    excludedShopTypes: Array.isArray(preferences?.excludedShopTypes)
      ? preferences.excludedShopTypes
      : [],
  };
  if (gender === "female") return merged;
  return {
    ...merged,
    coverage: "no_preference",
    silhouette: "balanced",
    heels: "any",
    hijabPreference: null,
  };
}
