import assert from "node:assert/strict";
import sharp from "sharp";
import {
  assertFurnitureIdentityPreserved,
  calculateStructuralSimilarity,
  FurnitureIdentityError,
} from "../src/lib/image-structure";

const width = 640;
const height = 426;

function svgBuffer(markup: string): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markup}</svg>`);
}

async function render(markup: string): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: "#d8d1c4" } })
    .composite([{ input: svgBuffer(markup) }])
    .png()
    .toBuffer();
}

const source = await render(`
  <path d="M0 80 H640 M0 350 H640" stroke="#777" stroke-width="5" />
  <rect x="55" y="95" width="530" height="230" fill="#6c3b21" stroke="#24150d" stroke-width="9" />
  <path d="M230 100 V320 M410 100 V320 M55 205 H585" stroke="#24150d" stroke-width="8" />
  <path d="M55 265 H585" stroke="#24150d" stroke-width="7" />
  <path d="M85 325 V370 M555 325 V370" stroke="#24150d" stroke-width="12" />
`);

// Valid makeover: colors change while every edge and structural line remains.
const finishOnly = await sharp(source)
  .modulate({ brightness: 0.82, saturation: 0.65, hue: 80 })
  .png()
  .toBuffer();

// Invalid makeover: a different cabinet size and drawer configuration.
const redesigned = await render(`
  <path d="M0 30 H640 M0 390 H640" stroke="#999" stroke-width="4" />
  <rect x="165" y="45" width="310" height="330" fill="#4a552f" stroke="#15200e" stroke-width="9" />
  <path d="M320 50 V370 M165 135 H475 M165 225 H475 M165 300 H475" stroke="#15200e" stroke-width="8" />
  <path d="M195 375 V410 M445 375 V410" stroke="#15200e" stroke-width="12" />
`);

const finishOnlyScore = await calculateStructuralSimilarity(source, finishOnly);
const redesignedScore = await calculateStructuralSimilarity(source, redesigned);

assert.ok(finishOnlyScore > 0.9, `finish-only edit score was ${finishOnlyScore}`);
assert.ok(redesignedScore < 0.55, `redesigned furniture score was ${redesignedScore}`);
await assert.doesNotReject(() => assertFurnitureIdentityPreserved(source, finishOnly));
await assert.rejects(
  () => assertFurnitureIdentityPreserved(source, redesigned),
  (error: unknown) => error instanceof FurnitureIdentityError,
);

console.log("PASS image structure: accepts finish-only edits and rejects redesigned furniture");
