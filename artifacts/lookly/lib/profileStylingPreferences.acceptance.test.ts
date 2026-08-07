import { normalizeStylingPreferencesForGender } from "./profileStylingPreferences";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const femalePreferences = {
  coverage:"maximum_coverage" as const,
  silhouette:"relaxed" as const,
  heels:"flats" as const,
  hijabPreference:"always" as const,
  excludedShopTypes:["skirt" as const],
};

const female = normalizeStylingPreferencesForGender("female", femalePreferences);
assert(female.coverage === "maximum_coverage", "female coverage must be preserved");
assert(female.hijabPreference === "always", "female hijab choice must be preserved");

for (const gender of ["male", "non-binary", "prefer_not_to_say", null] as const) {
  const normalized = normalizeStylingPreferencesForGender(gender, femalePreferences);
  assert(normalized.coverage === "no_preference", `${gender} coverage must reset`);
  assert(normalized.silhouette === "balanced", `${gender} silhouette must reset`);
  assert(normalized.heels === "any", `${gender} footwear must reset`);
  assert(normalized.hijabPreference === null, `${gender} hijab choice must reset`);
  assert(normalized.excludedShopTypes[0] === "skirt", `${gender} shop exclusions must remain available`);
}

console.log("Profile styling-preference gender checks passed");
