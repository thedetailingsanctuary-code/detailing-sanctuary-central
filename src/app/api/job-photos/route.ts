import { NextResponse, type NextRequest } from "next/server";
import { apiError, NO_STORE } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { deletePhoto, listCustomerPhotos, listJobPhotos, savePhoto } from "@/lib/photos/store";
import { MAX_UPLOAD_BYTES, photoKind } from "@/lib/photos/types";
import { hasSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const jobId = req.nextUrl.searchParams.get("jobId");
    const customer = req.nextUrl.searchParams.get("customer");
    if (!jobId && !customer) return NextResponse.json({ error: "Which job?" }, { status: 400 });
    const photos = jobId ? await listJobPhotos(jobId) : await listCustomerPhotos(customer!);
    return NextResponse.json({ photos }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Photos need Supabase" }, { status: 503 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No photo attached" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "That photo is too big" }, { status: 413 });
    }

    const str = (key: string) => {
      const v = form.get(key);
      return typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null;
    };
    const num = (key: string) => {
      const v = Number(form.get(key));
      return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
    };

    const photo = await savePhoto({
      file,
      jobId: str("jobId"),
      jobDate: str("jobDate"),
      customerName: str("customerName"),
      postcode: str("postcode"),
      kind: photoKind(form.get("kind")),
      note: str("note"),
      width: num("width"),
      height: num("height"),
    });
    return NextResponse.json({ photo }, NO_STORE);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSession();
    if (!hasSupabase()) return NextResponse.json({ error: "Photos need Supabase" }, { status: 503 });
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Which photo?" }, { status: 400 });
    await deletePhoto(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
