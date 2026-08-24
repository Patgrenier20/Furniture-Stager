import sharp from "sharp";

/**
 * Compares grayscale edge structure instead of raw color. Paint and stain can
 * change most furniture pixels while drawer boundaries, silhouette, camera
 * framing, and background edges should remain aligned with the source.
 */
export async function calculateStructuralSimilarity(source: Buffer, candidate: Buffer): Promise<number> {
  const sourceDimensions = await sharp(source).metadata();
  if (!sourceDimensions.width || !sourceDimensions.height) {
    throw new Error("Could not read source image dimensions");
  }

  const landscape = sourceDimensions.width >= sourceDimensions.height;
  const targetWidth = landscape
    ? 384
    : Math.max(128, Math.round(384 * (sourceDimensions.width / sourceDimensions.height)));
  const targetHeight = landscape
    ? Math.max(128, Math.round(384 * (sourceDimensions.height / sourceDimensions.width)))
    : 384;

  const [sourcePixels, candidatePixels] = await Promise.all([
    sharp(source).resize(targetWidth, targetHeight, { fit: "fill" }).greyscale().raw().toBuffer(),
    sharp(candidate).resize(targetWidth, targetHeight, { fit: "fill" }).greyscale().raw().toBuffer(),
  ]);

  let dotProduct = 0;
  let sourceMagnitudeSquared = 0;
  let candidateMagnitudeSquared = 0;

  // Central-difference edge magnitude is intentionally color-independent.
  // Skipping the one-pixel border avoids special-case sampling logic.
  for (let y = 1; y < targetHeight - 1; y += 1) {
    for (let x = 1; x < targetWidth - 1; x += 1) {
      const index = y * targetWidth + x;
      const sourceDx = sourcePixels[index + 1] - sourcePixels[index - 1];
      const sourceDy = sourcePixels[index + targetWidth] - sourcePixels[index - targetWidth];
      const candidateDx = candidatePixels[index + 1] - candidatePixels[index - 1];
      const candidateDy = candidatePixels[index + targetWidth] - candidatePixels[index - targetWidth];
      const sourceEdge = Math.hypot(sourceDx, sourceDy);
      const candidateEdge = Math.hypot(candidateDx, candidateDy);

      dotProduct += sourceEdge * candidateEdge;
      sourceMagnitudeSquared += sourceEdge * sourceEdge;
      candidateMagnitudeSquared += candidateEdge * candidateEdge;
    }
  }

  const denominator = Math.sqrt(sourceMagnitudeSquared * candidateMagnitudeSquared);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export class FurnitureIdentityError extends Error {
  constructor(public readonly similarity: number) {
    super(`Generated image did not preserve furniture structure (similarity ${similarity.toFixed(3)})`);
    this.name = "FurnitureIdentityError";
  }
}

export async function assertFurnitureIdentityPreserved(
  source: Buffer,
  candidate: Buffer,
  minimumSimilarity = 0.55,
): Promise<number> {
  const similarity = await calculateStructuralSimilarity(source, candidate);
  if (similarity < minimumSimilarity) {
    throw new FurnitureIdentityError(similarity);
  }
  return similarity;
}
