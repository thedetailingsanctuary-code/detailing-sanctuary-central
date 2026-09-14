/** Condition photos attached to a booking. Shared by the server and the browser. */

export type PhotoKind = "before" | "after" | "damage";

export const PHOTO_KINDS: { id: PhotoKind; label: string }[] = [
  { id: "before", label: "Before" },
  { id: "after", label: "After" },
  { id: "damage", label: "Damage" },
];

export type JobPhoto = {
  id: string;
  createdAt: string;
  jobId: string | null;
  jobDate: string | null;
  customerName: string | null;
  postcode: string | null;
  kind: PhotoKind;
  note: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  /** Short-lived signed link. Null if the link could not be made. */
  url: string | null;
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function photoKind(raw: unknown): PhotoKind {
  return raw === "after" || raw === "damage" ? raw : "before";
}
