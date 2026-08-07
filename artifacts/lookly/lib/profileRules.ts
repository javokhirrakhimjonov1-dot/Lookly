export const MIN_SUPPORTED_AGE = 12;
export const MAX_SUPPORTED_AGE = 50;

export function isSupportedAge(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= MIN_SUPPORTED_AGE && Number(value) <= MAX_SUPPORTED_AGE;
}

export function needsHijabProfileCompletion(
  gender: string | null | undefined,
  hijabPreference: "always" | "no" | null | undefined,
): boolean {
  return gender === "female" && hijabPreference == null;
}
