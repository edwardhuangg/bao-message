// Renders the PWA icons from assets/bao-icon.svg. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const src = "assets/bao-icon.svg";
await mkdir("public/icons", { recursive: true });

await sharp(src).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(src).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(src).resize(180, 180).png().toFile("src/app/apple-icon.png");

console.log("icons written: public/icons/{icon-192,icon-512}.png, src/app/apple-icon.png");
