import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import Database from "better-sqlite3";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 4000);
const APP_ORIGINS = (process.env.APP_ORIGINS || process.env.APP_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOW_ALL_ORIGINS = APP_ORIGINS.includes("*");

const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(dataDir, "uploads");
const dbPath = path.join(dataDir, "photos.db");

fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

const insertPhoto = db.prepare(`
  INSERT INTO photos (id, name, filename, mime_type, size, created_at)
  VALUES (@id, @name, @filename, @mime_type, @size, @created_at)
`);

const listPhotos = db.prepare(`
  SELECT id, name, filename, mime_type, size, created_at
  FROM photos
  ORDER BY created_at DESC
`);

const getPhoto = db.prepare(`
  SELECT id, name, filename, mime_type, size, created_at
  FROM photos
  WHERE id = ?
`);

const listPhotoFiles = db.prepare(`
  SELECT filename
  FROM photos
`);

const deletePhoto = db.prepare(`
  DELETE FROM photos
  WHERE id = ?
`);

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (ALLOW_ALL_ORIGINS || !origin || APP_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const extension = path.extname(file.originalname) || "";
    cb(null, `${uniquePrefix}${extension}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const thumbnailFilenameFromOriginal = (filename) => {
  const parsed = path.parse(filename);
  return `thumb-${parsed.name}.webp`;
};

const thumbnailPathFromOriginal = (filename) =>
  path.join(uploadsDir, thumbnailFilenameFromOriginal(filename));

const ensureThumbnail = async (filename) => {
  const sourcePath = path.join(uploadsDir, filename);
  const thumbnailPath = thumbnailPathFromOriginal(filename);

  await sharp(sourcePath)
    .rotate()
    .resize({
      width: 480,
      height: 480,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 70 })
    .toFile(thumbnailPath);
};

const backfillThumbnails = async () => {
  for (const row of listPhotoFiles.all()) {
    const thumbnailPath = thumbnailPathFromOriginal(row.filename);
    if (fs.existsSync(thumbnailPath)) {
      continue;
    }
    try {
      await ensureThumbnail(row.filename);
    } catch (error) {
      console.warn(`Failed thumbnail backfill for ${row.filename}: ${error.message}`);
    }
  }
};

const photoToResponse = (photo) => ({
  id: photo.id,
  name: photo.name,
  url: `/uploads/${photo.filename}`,
  thumbnailUrl: fs.existsSync(thumbnailPathFromOriginal(photo.filename))
    ? `/uploads/${thumbnailFilenameFromOriginal(photo.filename)}`
    : `/uploads/${photo.filename}`,
  addedAt: photo.created_at,
  downloadUrl: `/api/photos/${photo.id}/download`,
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/photos", (_req, res) => {
  const photos = listPhotos.all().map(photoToResponse);
  res.json({ photos });
});

app.post("/api/photos", upload.array("photos"), async (req, res, next) => {
  try {
  const files = req.files || [];
  const now = Date.now();
  const created = [];

  for (const file of files) {
    const id = randomUUID();
    insertPhoto.run({
      id,
      name: file.originalname,
      filename: file.filename,
      mime_type: file.mimetype,
      size: file.size,
      created_at: now,
    });
    await ensureThumbnail(file.filename);
    created.push(
      photoToResponse({
        id,
        name: file.originalname,
        filename: file.filename,
        created_at: now,
      })
    );
  }

  res.status(201).json({ photos: created });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/photos/:id", (req, res) => {
  const photo = getPhoto.get(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const filePath = path.join(uploadsDir, photo.filename);
  const thumbnailPath = thumbnailPathFromOriginal(photo.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (fs.existsSync(thumbnailPath)) {
    fs.unlinkSync(thumbnailPath);
  }
  deletePhoto.run(req.params.id);
  res.status(204).send();
});

app.get("/api/photos/:id/download", (req, res) => {
  const photo = getPhoto.get(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const filePath = path.join(uploadsDir, photo.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File missing on disk" });
    return;
  }

  res.download(filePath, photo.name);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(400).json({ error: error.message || "Request failed" });
});

app.listen(PORT, () => {
  console.log(`Local photo server running on http://localhost:${PORT}`);
  console.log(`Database path: ${dbPath}`);
  console.log(`Uploads path: ${uploadsDir}`);
});

backfillThumbnails().catch((error) => {
  console.warn(`Thumbnail backfill failed: ${error.message}`);
});
