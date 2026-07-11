import colors from "@/constants/colors";

/** Returns the warm cream / espresso light palette. */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
