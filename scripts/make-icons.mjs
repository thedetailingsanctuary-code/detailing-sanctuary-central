// Builds every icon the app and the Play Store need from one vector source.
// Source: public/icons/source/app-icon-gold.svg (2048x2048, shield centred with generous padding).
// Run: npm run icons
import sharp from "sharp";

const SRC = "public/icons/source/app-icon-gold.svg";
const BG = "#08080a";
const OUT = "public/icons";

/** Render the SVG at a given pixel size, optionally zooming in (crop factor < 1 = tighter framing). */
async function render(size, crop = 1) {
  const full = Math.round(size / crop);
  const buf = await sharp(SRC, { density: 300 }).resize(full, full).png().toBuffer();
  if (crop === 1) return buf;
  const offset = Math.round((full - size) / 2);
  return sharp(buf).extract({ left: offset, top: offset, width: size, height: size }).png().toBuffer();
}

async function save(buf, name) {
  await sharp(buf).png().toFile(`${OUT}/${name}`);
  console.log(name);
}

// "any" purpose icons: tighter framing so the shield reads well at small sizes.
await save(await render(512, 0.62), "icon-512.png");
await save(await render(192, 0.62), "icon-192.png");
await save(await render(180, 0.62), "apple-touch-icon.png");

// Maskable icons: keep the artwork inside the central 80% safe zone.
await save(await render(512, 0.8), "maskable-512.png");
await save(await render(192, 0.8), "maskable-192.png");

// Play Store listing icon: 512x512, no transparency.
await sharp(await render(512, 0.62)).flatten({ background: BG }).png().toFile("assets/store/play-icon-512.png");
console.log("assets/store/play-icon-512.png");

// Android status-bar badge: white silhouette on transparent.
{
  const { data, info } = await sharp(await render(96, 0.62))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const isArt = data[i + 3] > 40 && lum > 60;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = isArt ? 255 : 0;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(`${OUT}/badge-96.png`);
  console.log("badge-96.png");
}
