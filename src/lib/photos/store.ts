import "server-only";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import { ALLOWED_TYPES, photoKind, type JobPhoto, type PhotoKind } from "./types";

const BUCKET = "job-photos";
/** How long a photo link stays valid. Long enough to look through a job, short enough not to leak. */
const SIGNED_URL_SECONDS = 60 * 60;

type PhotoRow = {
  id: string;
  created_at: string;
  job_id: string | null;
  job_date: string | null;
  customer_name: string | null;
  postcode: string | null;
  kind: string;
  path: string;
  note: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
};

async function withUrls(rows: PhotoRow[]): Promise<JobPhoto[]> {
  if (rows.length === 0) return [];
  const { data } = await getSupabase()
    .storage.from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.path),
      SIGNED_URL_SECONDS,
    );
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    jobId: r.job_id,
    jobDate: r.job_date,
    customerName: r.customer_name,
    postcode: r.postcode,
    kind: photoKind(r.kind),
    note: r.note,
    width: r.width,
    height: r.height,
    bytes: r.bytes,
    url: byPath.get(r.path) ?? null,
  }));
}

/** Photos for one booking. */
export async function listJobPhotos(jobId: string): Promise<JobPhoto[]> {
  if (!hasSupabase()) return [];
  const { data, error } = await getSupabase()
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return withUrls(data as PhotoRow[]);
}

/** Everything ever taken for a customer, newest first - "have I done this car before?". */
export async function listCustomerPhotos(customerName: string, limit = 60): Promise<JobPhoto[]> {
  if (!hasSupabase()) return [];
  const { data, error } = await getSupabase()
    .from("job_photos")
    .select("*")
    .ilike("customer_name", customerName.trim())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return withUrls(data as PhotoRow[]);
}

export type UploadArgs = {
  file: File;
  jobId: string | null;
  jobDate: string | null;
  customerName: string | null;
  postcode: string | null;
  kind: PhotoKind;
  note: string | null;
  width: number | null;
  height: number | null;
};

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Put one photo in the private bucket and record it. */
export async function savePhoto(args: UploadArgs): Promise<JobPhoto> {
  if (!hasSupabase()) throw new Error("Photos need Supabase");
  const type = args.file.type;
  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) {
    throw new Error("That file is not a photo (JPEG, PNG or WebP only)");
  }

  const sb = getSupabase();
  const id = crypto.randomUUID();
  // Grouped by day rather than by booking: Outlook event ids are not safe as paths.
  const path = `${args.jobDate ?? "undated"}/${id}.${EXT[type] ?? "jpg"}`;

  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, await args.file.arrayBuffer(), { contentType: type, upsert: false });
  if (upErr) throw new Error(`Could not upload: ${upErr.message}`);

  const { data, error } = await sb
    .from("job_photos")
    .insert({
      id,
      job_id: args.jobId,
      job_date: args.jobDate,
      customer_name: args.customerName,
      postcode: args.postcode,
      kind: args.kind,
      path,
      note: args.note,
      width: args.width,
      height: args.height,
      bytes: args.file.size,
    })
    .select("*")
    .single<PhotoRow>();

  if (error) {
    // Do not leave an orphan file behind if the row could not be written.
    await sb.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return (await withUrls([data]))[0];
}

export async function deletePhoto(id: string): Promise<void> {
  const sb = getSupabase();
  const { data, error } = await sb.from("job_photos").select("path").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  await sb.storage.from(BUCKET).remove([data.path as string]);
  const { error: delErr } = await sb.from("job_photos").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);
}
