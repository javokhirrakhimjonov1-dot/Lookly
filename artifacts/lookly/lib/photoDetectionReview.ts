export type PhotoTaggedDetection = {
  _photoIndex?: number;
  _photoTotal?: number;
  _photoUri?: string;
};

export type PhotoDetectionReview<T extends PhotoTaggedDetection> = {
  photoIndex: number;
  photoTotal: number;
  imageUri: string;
  items: T[];
};

/**
 * Keep AI detections attached to the photo that produced them. The review UI
 * consumes these groups sequentially instead of flattening a multi-photo scan
 * beneath a single, misleading preview image.
 */
export function groupDetectionsByPhoto<T extends PhotoTaggedDetection>(
  items: T[],
  fallbackImageUri: string,
): PhotoDetectionReview<T>[] {
  const fallbackTotal = Math.max(1, ...items.map((item) => item._photoTotal ?? 1));
  const groups = new Map<number, PhotoDetectionReview<T>>();

  for (const item of items) {
    const photoIndex = item._photoIndex ?? 0;
    const existing = groups.get(photoIndex);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    groups.set(photoIndex, {
      photoIndex,
      photoTotal: item._photoTotal ?? fallbackTotal,
      imageUri: item._photoUri ?? fallbackImageUri,
      items: [item],
    });
  }

  return [...groups.values()].sort((left, right) => left.photoIndex - right.photoIndex);
}
