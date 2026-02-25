import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
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
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-local-auth-secret-change-me";
const TOKEN_TTL_MS = Number(process.env.TOKEN_TTL_MS || 1000 * 60 * 60 * 24 * 7);
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "admin";
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "admin123";

const dataDir = path.join(__dirname, "data");
const usersDir = path.join(dataDir, "users");
const legacyUsersFilePath = path.join(dataDir, "users.json");
const usersDbPath = path.join(dataDir, "users.db");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(usersDir, { recursive: true });

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
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

const bufferToBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlToBuffer = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
};

const signValue = (value) => createHmac("sha256", AUTH_SECRET).update(value).digest();

const hashPassword = (password, saltHex = randomBytes(16).toString("hex")) => ({
  saltHex,
  hashHex: scryptSync(password, saltHex, 64).toString("hex"),
});

const safeCompareHex = (leftHex, rightHex) => {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};

const usersDb = new Database(usersDbPath);
usersDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

const countUsers = usersDb.prepare("SELECT COUNT(*) AS count FROM users");
const findUserByLoginStmt = usersDb.prepare(`
  SELECT id, username, password_salt, password_hash, created_at
  FROM users
  WHERE lower(username) = lower(?) OR lower(id) = lower(?)
`);
const findUserByIdStmt = usersDb.prepare(`
  SELECT id, username, password_salt, password_hash, created_at
  FROM users
  WHERE id = ?
`);
const findUserByUsernameStmt = usersDb.prepare(`
  SELECT id, username, password_salt, password_hash, created_at
  FROM users
  WHERE lower(username) = lower(?)
`);
const insertUserStmt = usersDb.prepare(`
  INSERT INTO users (id, username, password_salt, password_hash, created_at)
  VALUES (@id, @username, @password_salt, @password_hash, @created_at)
`);
const listUsersStmt = usersDb.prepare(`
  SELECT id, username, password_salt, password_hash, created_at
  FROM users
  ORDER BY created_at ASC
`);

const normalizeUserId = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "user";

const migrateLegacyUsersIfNeeded = () => {
  const hasUsers = Number(countUsers.get().count) > 0;
  if (hasUsers || !fs.existsSync(legacyUsersFilePath)) {
    return;
  }
  try {
    const raw = fs.readFileSync(legacyUsersFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return;
    }
    const tx = usersDb.transaction((users) => {
      for (const user of users) {
        if (!user?.id || !user?.username || !user?.passwordSalt || !user?.passwordHash) {
          continue;
        }
        try {
          insertUserStmt.run({
            id: normalizeUserId(String(user.id)),
            username: String(user.username).trim(),
            password_salt: String(user.passwordSalt),
            password_hash: String(user.passwordHash),
            created_at: Number(user.createdAt) || Date.now(),
          });
        } catch {
          // ignore duplicates during migration
        }
      }
    });
    tx(parsed);
  } catch {
    // ignore malformed legacy file
  }
};

migrateLegacyUsersIfNeeded();

const ensureDefaultUser = () => {
  if (Number(countUsers.get().count) > 0) {
    return;
  }
  const { saltHex, hashHex } = hashPassword(DEFAULT_USER_PASSWORD);
  insertUserStmt.run({
    id: normalizeUserId(DEFAULT_USER_ID),
    username: DEFAULT_USER_ID,
    password_salt: saltHex,
    password_hash: hashHex,
    created_at: Date.now(),
  });
  console.log(`Created default user '${DEFAULT_USER_ID}'. Change DEFAULT_USER_PASSWORD in your env.`);
};

const findUserByLogin = (login) => findUserByLoginStmt.get(login, login);

const issueToken = (userId) => {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}.${expiresAt}.${randomUUID()}`;
  const payloadB64 = bufferToBase64Url(payload);
  const signatureB64 = bufferToBase64Url(signValue(payload));
  return `${payloadB64}.${signatureB64}`;
};

const verifyToken = (token) => {
  if (!token || !token.includes(".")) {
    return null;
  }
  const [payloadB64, signatureB64] = token.split(".");
  if (!payloadB64 || !signatureB64) {
    return null;
  }
  const payload = base64UrlToBuffer(payloadB64).toString("utf8");
  const receivedSig = base64UrlToBuffer(signatureB64);
  const expectedSig = signValue(payload);
  if (receivedSig.length !== expectedSig.length || !timingSafeEqual(receivedSig, expectedSig)) {
    return null;
  }
  const [userId, expiresAtRaw] = payload.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!userId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }
  return { userId, expiresAt };
};

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  if (typeof req.query.auth === "string" && req.query.auth.trim()) {
    return req.query.auth.trim();
  }
  return null;
};

const requireAuth = (req, res, next) => {
  const token = extractToken(req);
  const parsed = verifyToken(token);
  if (!parsed) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.authUserId = parsed.userId;
  req.authToken = token;
  next();
};

const storesByUserId = new Map();

const createStoreForUser = (userId) => {
  const safeUserId = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const userDir = path.join(usersDir, safeUserId);
  const uploadsDir = path.join(userDir, "uploads");
  const dbPath = path.join(userDir, "photos.db");

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

  return {
    uploadsDir,
    dbPath,
    insertPhoto: db.prepare(`
      INSERT INTO photos (id, name, filename, mime_type, size, created_at)
      VALUES (@id, @name, @filename, @mime_type, @size, @created_at)
    `),
    listPhotos: db.prepare(`
      SELECT id, name, filename, mime_type, size, created_at
      FROM photos
      ORDER BY created_at DESC
    `),
    getPhoto: db.prepare(`
      SELECT id, name, filename, mime_type, size, created_at
      FROM photos
      WHERE id = ?
    `),
    listPhotoFiles: db.prepare(`
      SELECT filename
      FROM photos
    `),
    deletePhoto: db.prepare(`
      DELETE FROM photos
      WHERE id = ?
    `),
  };
};

const getUserStore = (userId) => {
  if (!storesByUserId.has(userId)) {
    storesByUserId.set(userId, createStoreForUser(userId));
  }
  return storesByUserId.get(userId);
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const userStore = getUserStore(req.authUserId);
      cb(null, userStore.uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
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

const thumbnailPathFromOriginal = (uploadsDir, filename) =>
  path.join(uploadsDir, thumbnailFilenameFromOriginal(filename));

const ensureThumbnail = async (uploadsDir, filename) => {
  const sourcePath = path.join(uploadsDir, filename);
  const thumbnailPath = thumbnailPathFromOriginal(uploadsDir, filename);

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

const backfillThumbnails = async (store) => {
  for (const row of store.listPhotoFiles.all()) {
    const thumbnailPath = thumbnailPathFromOriginal(store.uploadsDir, row.filename);
    if (fs.existsSync(thumbnailPath)) {
      continue;
    }
    try {
      await ensureThumbnail(store.uploadsDir, row.filename);
    } catch (error) {
      console.warn(`Failed thumbnail backfill for ${row.filename}: ${error.message}`);
    }
  }
};

const photoToResponse = (store, photo) => ({
  id: photo.id,
  name: photo.name,
  url: `/uploads/${photo.filename}`,
  thumbnailUrl: fs.existsSync(thumbnailPathFromOriginal(store.uploadsDir, photo.filename))
    ? `/uploads/${thumbnailFilenameFromOriginal(photo.filename)}`
    : `/uploads/${photo.filename}`,
  addedAt: photo.created_at,
  downloadUrl: `/api/photos/${photo.id}/download`,
});

app.post("/api/auth/login", (req, res) => {
  const loginId = typeof req.body?.loginId === "string" ? req.body.loginId.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!loginId || !password) {
    res.status(400).json({ error: "loginId and password are required" });
    return;
  }

  ensureDefaultUser();
  const user = findUserByLogin(loginId);
  if (!user) {
    res.status(404).json({ code: "USER_NOT_FOUND", error: "User not found. Please create a new account." });
    return;
  }

  const computed = hashPassword(password, user.password_salt);
  if (!safeCompareHex(computed.hashHex, user.password_hash)) {
    res.status(401).json({ code: "INVALID_PASSWORD", error: "Incorrect password." });
    return;
  }

  const token = issueToken(user.id);
  getUserStore(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      storageFolder: `users/${user.id}`,
    },
  });
});

app.post("/api/auth/register", (req, res) => {
  const loginId = typeof req.body?.loginId === "string" ? req.body.loginId.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!loginId || !password) {
    res.status(400).json({ error: "loginId and password are required" });
    return;
  }
  if (loginId.length < 3) {
    res.status(400).json({ error: "loginId must be at least 3 characters" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "password must be at least 6 characters" });
    return;
  }
  if (findUserByUsernameStmt.get(loginId)) {
    res.status(409).json({ code: "USER_EXISTS", error: "Username already exists. Please choose a unique username." });
    return;
  }

  const baseId = normalizeUserId(loginId);
  let userId = baseId;
  let suffix = 2;
  while (findUserByIdStmt.get(userId)) {
    userId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const { saltHex, hashHex } = hashPassword(password);
  insertUserStmt.run({
    id: userId,
    username: loginId,
    password_salt: saltHex,
    password_hash: hashHex,
    created_at: Date.now(),
  });

  getUserStore(userId);
  res.status(201).json({
    message: "Account created successfully. Please sign in.",
    user: {
      id: userId,
      username: loginId,
      storageFolder: `users/${userId}`,
    },
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  ensureDefaultUser();
  const user = findUserByIdStmt.get(req.authUserId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    user: {
      id: user.id,
      username: user.username,
      storageFolder: `users/${user.id}`,
    },
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/photos", requireAuth, (req, res) => {
  const store = getUserStore(req.authUserId);
  const photos = store.listPhotos.all().map((photo) => photoToResponse(store, photo));
  res.json({ photos });
});

app.post("/api/photos", requireAuth, upload.array("photos"), async (req, res, next) => {
  try {
    const store = getUserStore(req.authUserId);
    const files = req.files || [];
    const now = Date.now();
    const created = [];

    for (const file of files) {
      const id = randomUUID();
      store.insertPhoto.run({
        id,
        name: file.originalname,
        filename: file.filename,
        mime_type: file.mimetype,
        size: file.size,
        created_at: now,
      });
      await ensureThumbnail(store.uploadsDir, file.filename);
      created.push(
        photoToResponse(store, {
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

app.delete("/api/photos/:id", requireAuth, (req, res) => {
  const store = getUserStore(req.authUserId);
  const photo = store.getPhoto.get(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const filePath = path.join(store.uploadsDir, photo.filename);
  const thumbnailPath = thumbnailPathFromOriginal(store.uploadsDir, photo.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (fs.existsSync(thumbnailPath)) {
    fs.unlinkSync(thumbnailPath);
  }
  store.deletePhoto.run(req.params.id);
  res.status(204).send();
});

app.get("/api/photos/:id/download", requireAuth, (req, res) => {
  const store = getUserStore(req.authUserId);
  const photo = store.getPhoto.get(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const filePath = path.join(store.uploadsDir, photo.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File missing on disk" });
    return;
  }

  res.download(filePath, photo.name);
});

app.get("/uploads/:filename", requireAuth, (req, res) => {
  const store = getUserStore(req.authUserId);
  const filename = path.basename(req.params.filename);
  const filePath = path.join(store.uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.sendFile(filePath);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error?.statusCode || error?.status || 400;
  res.status(status).json({ error: error.message || "Request failed" });
});

app.listen(PORT, () => {
  ensureDefaultUser();
  const users = listUsersStmt.all();
  for (const user of users) {
    const store = getUserStore(user.id);
    backfillThumbnails(store).catch((error) => {
      console.warn(`Thumbnail backfill failed for ${user.id}: ${error.message}`);
    });
  }
  console.log(`Local photo server running on http://localhost:${PORT}`);
  console.log(`Users path: ${usersDir}`);
  console.log(`Default login id: ${DEFAULT_USER_ID}`);
});
