import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Detailing Sanctuary Central",
    short_name: "DS Central",
    description: "Schedule, rain alerts, prices and gallery for Detailing Sanctuary.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08080a",
    theme_color: "#08080a",
    lang: "en-GB",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Prices", url: "/pricing", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Gallery", url: "/gallery", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
