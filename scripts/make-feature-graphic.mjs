// Composes the Google Play feature graphic (1024x500): AI-rendered driveway scene + DS shield + brand wordmark.
// Run: node scripts/make-feature-graphic.mjs
import sharp from "sharp";

const BASE = "assets/store/feature-graphic-plain.png";
const SHIELD = "public/icons/source/app-icon-mark.svg"; // transparent background
const LOGO = "public/icons/logo.png";
const OUT = "assets/store/feature-graphic.png";

// Shield: render tight and small.
const shieldFull = await sharp(SHIELD, { density: 300 }).resize(290, 290).png().toBuffer();
const shield = await sharp(shieldFull).extract({ left: 55, top: 55, width: 180, height: 180 }).png().toBuffer();

// Wordmark: the text band from the website logo, blended with "screen" so its black background disappears.
const wordmark = await sharp(LOGO).extract({ left: 10, top: 358, width: 827, height: 142 }).resize({ width: 340 }).png().toBuffer();
const wm = await sharp(wordmark).metadata();

await sharp(BASE)
  .composite([
    { input: shield, left: 140, top: 105 },
    { input: wordmark, left: 60, top: 300, blend: "screen" },
  ])
  .png()
  .toFile(OUT);
console.log("wrote", OUT, "wordmark", wm.width, "x", wm.height);
