"use client";
import { useState } from "react";
import type { Job } from "@/lib/calendar/types";
import { formatTime } from "@/lib/time";
import { JobPhotos } from "./JobPhotos";

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-gold" aria-hidden>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

export function HeroJobCard({ job, status, now }: { job: Job; status: "now" | "next"; now: number }) {
  const startsIn = Math.round((new Date(job.start).getTime() - now) / 60000);
  let when: string;
  if (status === "now") when = `In progress - finishes ${formatTime(job.end)}`;
  else if (startsIn < 60) when = `Starts in ${Math.max(startsIn, 0)} min`;
  else if (startsIn < 24 * 60) when = `Starts in ${Math.floor(startsIn / 60)} h ${startsIn % 60} min`;
  else when = `${formatTime(job.start)} - ${formatTime(job.end)}`;

  return (
    <section className="card-gold p-4" aria-label={status === "now" ? "Current job" : "Next job"}>
      <div className="flex items-center justify-between">
        <span className={`pill border-gold/60 text-gold ${status === "now" ? "pulse" : ""}`}>
          {status === "now" ? "On site now" : "Next up"}
        </span>
        <span className="font-display text-3xl text-gold">{formatTime(job.start)}</span>
      </div>
      <h2 className="mt-2 font-display text-2xl uppercase leading-tight">{job.service}</h2>
      {job.customerName && <p className="text-lg text-fg-dim">{job.customerName}</p>}
      <p className="mt-1 text-sm text-fg-muted">{when}</p>

      {job.address && (
        <a
          href={mapsUrl(job.address)}
          target="_blank"
          rel="noopener"
          className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-sm leading-snug"
        >
          <PinIcon />
          <span>{job.address}</span>
        </a>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {job.phone && (
          <a href={`tel:${job.phone}`} className="btn btn-gold">
            Call
          </a>
        )}
        {job.address && (
          <a href={mapsUrl(job.address)} target="_blank" rel="noopener" className="btn btn-ghost">
            Directions
          </a>
        )}
      </div>

      {job.notes && <p className="mt-3 whitespace-pre-line text-sm text-fg-dim">{job.notes}</p>}

      <div className="mt-3 border-t border-line pt-3">
        <JobPhotos job={job} />
      </div>
    </section>
  );
}

export function JobRow({ job, muted = false }: { job: Job; muted?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`card overflow-hidden ${muted ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left"
        aria-expanded={open}
      >
        <div className="w-16 shrink-0">
          <div className="font-display text-xl leading-none text-gold">{job.isAllDay ? "All day" : formatTime(job.start)}</div>
          {!job.isAllDay && <div className="mt-1 text-xs text-fg-muted">to {formatTime(job.end)}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg uppercase leading-tight">{job.service}</div>
          <div className="truncate text-sm text-fg-dim">
            {job.customerName ?? "No customer name"}
            {job.postcode ? ` - ${job.postcode}` : ""}
          </div>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3 text-sm">
          {job.address && (
            <a href={mapsUrl(job.address)} target="_blank" rel="noopener" className="flex items-start gap-2">
              <PinIcon />
              <span>{job.address}</span>
            </a>
          )}
          {job.notes && <p className="whitespace-pre-line text-fg-dim">{job.notes}</p>}
          <div className="flex flex-wrap gap-2">
            {job.phone && (
              <a href={`tel:${job.phone}`} className="btn btn-gold min-h-11 text-sm">
                Call
              </a>
            )}
            {job.email && (
              <a href={`mailto:${job.email}`} className="btn btn-ghost min-h-11 text-sm">
                Email
              </a>
            )}
            {job.webLink && (
              <a href={job.webLink} target="_blank" rel="noopener" className="btn btn-ghost min-h-11 text-sm">
                Open in Outlook
              </a>
            )}
          </div>
          <div className="border-t border-line pt-3">
            <JobPhotos job={job} />
          </div>
        </div>
      )}
    </li>
  );
}
