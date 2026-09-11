import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getSupabase, hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const BUCKET = "gallery";
const MAX_BYTES = 15 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export type GalleryPhoto = {
  id: string;
  url: string;
  caption: string | null;
  takenOn: string | null;
  createdAt: string;
};

type Row = { id: string; storage_path: string; caption: string | null; taken_on: string | null; created_at: string };

const DEMO_PHOTOS: GalleryPhoto[] = [1, 2, 3, 4].map((n) => ({
  id: `demo-${n}`,
  url: `/demo/sample-${n}.jpg`,
  caption: n === 1 ? "Sample photo (local preview)" : null,
  takenOn: null,
  createdAt: new Date().toISOString(),
}));

export async function GET() {
  try {
    await requireSession();
    if (!hasSupabase()) {
      return NextResponse.json({ photos: DEMO_PHOTOS, canUpload: false, demo: true }, NO_STORE);
    }
    const sb = getSupabase();
    const { data, error } = await sb
      .from("gallery_photos")
      .select("id,storage_path,caption,taken_on,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const photos: GalleryPhoto[] = (data as Row[]).map((r) => ({
      id: r.id,
      url: sb.storage.from(BUCKET).getPublicUrl(r.storage_path).data.publicUrl,
      caption: r.caption,
      takenOn: r.taken_on,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ photos, canUpload: true, demo: false }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) {
      return NextResponse.json({ error: "Uploads need Supabase to be configured" }, { status: 503 });
    }
    const form = await req.formData();
    const file = form.get("file");
    const caption = String(form.get("caption") ?? "").trim() || null;
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is larger than 15 MB" }, { status: 413 });
    const ext = EXT_BY_TYPE[file.type] ?? (file.name.split(".").pop() || "jpg").toLowerCase();
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Only images are allowed" }, { status: 415 });

    const sb = getSupabase();
    const path = `${new Date().getUTCFullYear()}/${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
    if (up.error) throw new Error(`Upload failed: ${up.error.message}`);

    const { data, error } = await sb
      .from("gallery_photos")
      .insert({ storage_path: path, caption })
      .select("id,storage_path,caption,taken_on,created_at")
      .single<Row>();
    if (error) throw new Error(error.message);

    const photo: GalleryPhoto = {
      id: data.id,
      url: sb.storage.from(BUCKET).getPublicUrl(data.storage_path).data.publicUrl,
      caption: data.caption,
      takenOn: data.taken_on,
      createdAt: data.created_at,
    };
    return NextResponse.json({ photo }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Not available in preview" }, { status: 503 });
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const sb = getSupabase();
    const { data } = await sb.from("gallery_photos").select("storage_path").eq("id", id).maybeSingle<{ storage_path: string }>();
    if (!data) return NextResponse.json({ ok: true, missing: true });
    await sb.storage.from(BUCKET).remove([data.storage_path]);
    const { error } = await sb.from("gallery_photos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
