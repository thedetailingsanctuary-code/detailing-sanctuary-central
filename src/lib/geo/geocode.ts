import "server-only";
import { UK_POSTCODE_RE } from "@/lib/calendar/parse";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import type { LatLng } from "@/lib/weather/types";

export type GeocodeResult = LatLng & { source: "postcodes.io" | "nominatim" | "cache"; label: string };

const memory = new Map<string, GeocodeResult>();

function normalise(address: string): string {
  return address.toLowerCase().replace(/\s+/g, " ").trim();
}

async function byPostcode(postcode: string): Promise<GeocodeResult | null> {
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { latitude: number; longitude: number; postcode: string } };
  if (!json.result) return null;
  return {
    lat: json.result.latitude,
    lng: json.result.longitude,
    source: "postcodes.io",
    label: json.result.postcode,
  };
}

async function byNominatim(address: string): Promise<GeocodeResult | null> {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", address);
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "gb");
  const res = await fetch(u, {
    headers: { "user-agent": "DetailingSanctuaryCentral/1.0 (rain alerts; https://detailingsanctuary.co.uk)" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!arr[0]) return null;
  return { lat: Number(arr[0].lat), lng: Number(arr[0].lon), source: "nominatim", label: arr[0].display_name };
}

/**
 * Address -> coordinates. UK postcode first (postcodes.io, free, exact), then
 * OpenStreetMap as a fallback. Results are cached in memory and in Supabase.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = normalise(address);
  if (!key) return null;
  const hit = memory.get(key);
  if (hit) return hit;

  if (hasSupabase()) {
    try {
      const { data } = await getSupabase()
        .from("geocode_cache")
        .select("lat,lng,label")
        .eq("address_key", key)
        .maybeSingle();
      if (data) {
        const r: GeocodeResult = {
          lat: Number(data.lat),
          lng: Number(data.lng),
          source: "cache",
          label: String(data.label ?? key),
        };
        memory.set(key, r);
        return r;
      }
    } catch (e) {
      console.warn("[geocode] cache read failed", e);
    }
  }

  let result: GeocodeResult | null = null;
  const pc = address.match(UK_POSTCODE_RE);
  if (pc) {
    try {
      result = await byPostcode(`${pc[1]} ${pc[2]}`);
    } catch (e) {
      console.warn("[geocode] postcodes.io failed", e);
    }
  }
  if (!result) {
    try {
      result = await byNominatim(address);
    } catch (e) {
      console.warn("[geocode] nominatim failed", e);
    }
  }
  if (!result) return null;

  memory.set(key, result);
  if (hasSupabase()) {
    try {
      await getSupabase().from("geocode_cache").upsert({
        address_key: key,
        lat: result.lat,
        lng: result.lng,
        source: result.source,
        label: result.label,
      });
    } catch (e) {
      console.warn("[geocode] cache write failed", e);
    }
  }
  return result;
}
