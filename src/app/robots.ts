import type { MetadataRoute } from "next";

/** Private tool - keep search engines out. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
