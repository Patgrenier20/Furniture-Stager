import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");
const extensionsByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Never carry a user-controlled extension into a same-origin static path.
    // The allowlisted MIME type determines the stored extension.
    const ext = extensionsByMimeType[file.mimetype];
    if (!ext) {
      cb(new Error("Unsupported image type"), "");
      return;
    }
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in extensionsByMimeType) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});
