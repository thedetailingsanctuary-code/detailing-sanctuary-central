"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/calendar/types";
import { errorMessage, fetchJson } from "@/lib/client-hooks";
import { shrinkImage } from "@/lib/photos/resize";
import { PHOTO_KINDS, type JobPhoto, type PhotoKind } from "@/lib/photos/types";
import { formatTime, londonDateKey } from "@/lib/time";

/**
 * Condition photos for one booking. Taken on arrival, they are dated proof of
 * how the car looked before anything was touched.
 */
export function JobPhotos({ job }: { job: Job }) {
  const [photos, setPhotos] = useState<JobPhoto[] | null>(null);
  const [kind, setKind] = useState<PhotoKind>("before");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<JobPhoto | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      fetchJson<{ photos: JobPhoto[] }>(`/api/job-photos?jobId=${encodeURIComponent(job.id)}`)
        .then((r) => setPhotos(r.photos))
        .catch((e: unknown) => {
          setPhotos([]);
          setError(errorMessage(e, "Could not load photos"));
        }),
    [job.id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // so the same photo can be picked again
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const { blob, width, height } = await shrinkImage(file);
        const form = new FormData();
        form.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
        form.append("jobId", job.id);
        form.append("jobDate", londonDateKey(new Date(job.start)));
        form.append("kind", kind);
        form.append("width", String(width));
        form.append("height", String(height));
        if (job.customerName) form.append("customerName", job.customerName);
        if (job.postcode) form.append("postcode", job.postcode);
        await fetchJson<{ photo: JobPhoto }>("/api/job-photos", { method: "POST", body: form });
      }
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not save the photo"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: JobPhoto) => {
    setBusy(true);
    try {
      await fetchJson(`/api/job-photos?id=${photo.id}`, { method: "DELETE" });
      setViewing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Could not delete"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-xs uppercase tracking-wider text-fg-muted">
          Photos{photos?.length ? ` (${photos.length})` : ""}
        </span>
        <div className="flex gap-1">
          {PHOTO_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              data-active={kind === k.id}
              className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-2.5 font-display text-[0.62rem] uppercase tracking-wider text-fg-dim data-[active=true]:border-gold data-[active=true]:bg-gold data-[active=true]:text-ink"
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {photos && photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setViewing(p)}
                className="relative block aspect-square w-full overflow-hidden rounded-lg border border-line bg-surface-2"
              >
                {p.url ? (
                  // Signed Supabase links expire, so plain <img> rather than next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={`${p.kind} photo`} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[0.6rem] text-fg-muted">No preview</span>
                )}
                <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[0.55rem] uppercase tracking-wider text-fg-dim">
                  {p.kind}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={onPick}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn btn-ghost min-h-11 w-full text-sm"
      >
        {busy ? "Saving..." : `Take ${PHOTO_KINDS.find((k) => k.id === kind)?.label.toLowerCase()} photo`}
      </button>

      {error && <p className="text-xs text-danger">{error}</p>}

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
        >
          <button type="button" className="flex-1" onClick={() => setViewing(null)} aria-label="Close">
            {viewing.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.url} alt={`${viewing.kind} photo`} className="h-full w-full object-contain" />
            )}
          </button>
          <div
            className="flex items-center justify-between gap-2 border-t border-line bg-ink p-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            <span className="text-xs text-fg-muted">
              {viewing.kind} - {formatTime(viewing.createdAt)}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => remove(viewing)} disabled={busy} className="btn btn-ghost min-h-10 px-3 text-xs">
                Delete
              </button>
              <button type="button" onClick={() => setViewing(null)} className="btn btn-gold min-h-10 px-3 text-xs">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
