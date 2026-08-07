import type { ClothingItem } from "@/contexts/WardrobeContext";

export type BaseSlot = "tops" | "bottoms" | "dresses";

export function enforceExclusiveBase<T extends Partial<Record<BaseSlot, ClothingItem>>>(input: T, lockedSlots: ReadonlySet<string>): T {
  const next = { ...input };
  const separatesLocked = lockedSlots.has("tops") || lockedSlots.has("bottoms");
  if (lockedSlots.has("dresses")) {
    if (!lockedSlots.has("tops")) delete next.tops;
    if (!lockedSlots.has("bottoms")) delete next.bottoms;
  } else if (separatesLocked) delete next.dresses;
  else if (next.dresses) { delete next.tops; delete next.bottoms; }
  return next;
}

export function packingSeparateTargets(topsNeeded: number, bottomsNeeded: number, dressesAvailable: number) {
  const dressesUsed = Math.min(Math.max(0, dressesAvailable), Math.max(0, bottomsNeeded));
  return { dressesUsed, topsNeeded:Math.max(0, topsNeeded-dressesUsed), bottomsNeeded:Math.max(0, bottomsNeeded-dressesUsed) };
}
