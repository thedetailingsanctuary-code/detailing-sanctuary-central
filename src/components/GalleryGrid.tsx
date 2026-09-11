"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage, fetchJson } from "@/lib/client-hooks";

type Photo = { id: string; url: string; caption: string | null; takenOn: string | null; createdAt: string };
type Listing = { photos: Photo[]; canUpload: boolean; demo: boolean };

export function GalleryGrid() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      fetchJson<Listing>("/api/gallery")
        .then((l) => {
          setListing(l);
          setError(null);
        })
        .catch((e: unknown) => setError(errorMessage(e, "Could not load gallery"))),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(`Uploading ${files.length} photo${files.length > 1 ? "s" : ""}...`);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        await fetchJson("/api/gallery", { method: "POST", body: fd });
      }
      await load();
    } catch (e) {
      setError(errorMessage(e, "Upload failed"));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(photo: Photo) {
    if (!window.confirm("Delete this photo?")) return;
    setBusy("Deleting...");
    try {
      await fetchJson(`/api/gallery?id=${encodeURIComponent(photo.id)}`, { method: "DELETE" });
      setOpen(null);
      await load();
    } catch (e) {
      setError(errorMessage(e, "Delete failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {listing ? `${listing.photos.length} photo${listing.photos.length === 1 ? "" : "s"}` : "Loading..."}
        </p>
        {listing?.canUpload ? (
          <label className="btn btn-gold min-h-11 cursor-pointer text-sm">
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
            {busy ?? "Add photos"}
          </label>
        ) : (
          listing && <span className="text-xs text-fg-muted">Uploads need Supabase (see setup)</span>
        )}
      </div>

      {error && <p className="card border-danger/50 p-3 text-sm text-danger">{error}</p>}

      {listing && listing.photos.length === 0 && (
        <p className="card p-6 text-center text-sm text-fg-muted">No photos yet. Add your best recent work.</p>
      )}

      <ul className="grid grid-cols-2 gap-2">
        {listing?.photos.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(p)} className="block w-full overflow-hidden rounded-xl bg-surface-2">
              <img src={p.url} alt={p.caption ?? "Work photo"} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between p-3">
            <button type="button" onClick={() => setOpen(null)} className="btn btn-ghost min-h-11 text-sm">
              Close
            </button>
            {listing?.canUpload && (
              <button type="button" onClick={() => void remove(open)} className="btn btn-ghost min-h-11 text-sm text-danger">
                Delete
              </button>
            )}
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-2">
            <img src={open.url} alt={open.caption ?? "Work photo"} className="max-h-full max-w-full object-contain" />
          </div>
          {open.caption && <p className="p-4 text-center text-sm text-fg-dim">{open.caption}</p>}
        </div>
      )}
    </div>
  );
}
