import express from "express";
import axios from "axios";
import cors from "cors";

const PORT = Number(process.env.PROXY_PORT || 4001);
const PHOTO_SERVER_URL = process.env.PHOTO_SERVER_URL || "http://localhost:4000";
const APP_ORIGINS = (process.env.APP_ORIGINS || process.env.APP_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOW_ALL_ORIGINS = APP_ORIGINS.includes("*");

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

const getForwardHeaders = (req) => {
  const headers = {};
  if (req.headers["content-type"]) {
    headers["content-type"] = req.headers["content-type"];
  }
  if (req.headers["content-length"]) {
    headers["content-length"] = req.headers["content-length"];
  }
  if (req.headers.authorization) {
    headers.authorization = req.headers.authorization;
  }
  return headers;
};

const forwardJson = async (req, res, method) => {
  try {
    const response = await axios({
      method,
      url: `${PHOTO_SERVER_URL}${req.originalUrl}`,
      data: method === "GET" || method === "DELETE" ? undefined : req,
      headers: getForwardHeaders(req),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });

    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    res.status(response.status).send(response.data);
  } catch (error) {
    console.error(`Proxy error [${method} ${req.originalUrl}]`, error.message);
    res.status(503).json({ error: "Database server is down" });
  }
};

const forwardDownload = async (req, res) => {
  try {
    const response = await axios.get(`${PHOTO_SERVER_URL}${req.originalUrl}`, {
      responseType: "stream",
      headers: getForwardHeaders(req),
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      let rawBody = "";
      response.data.on("data", (chunk) => {
        rawBody += chunk.toString();
      });
      response.data.on("end", () => {
        try {
          res.status(response.status).json(JSON.parse(rawBody));
        } catch {
          res.status(response.status).json({ error: "Request failed" });
        }
      });
      return;
    }

    res.setHeader("Content-Type", response.headers["content-type"] || "image/jpeg");
    res.setHeader(
      "Content-Disposition",
      response.headers["content-disposition"] || `inline; filename="photo-${req.params.id}"`
    );

    response.data.pipe(res);
  } catch (error) {
    console.error(`Proxy error [GET ${req.originalUrl}]`, error.message);
    res.status(503).json({ error: "Database server is down" });
  }
};

const forwardAsset = async (req, res) => {
  try {
    const response = await axios.get(`${PHOTO_SERVER_URL}${req.originalUrl}`, {
      responseType: "stream",
      headers: getForwardHeaders(req),
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      res.status(response.status).json({ error: "File not found" });
      return;
    }

    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    response.data.pipe(res);
  } catch (error) {
    console.error(`Proxy error [GET ${req.originalUrl}]`, error.message);
    res.status(503).json({ error: "Database server is down" });
  }
};

app.get("/api/photos", async (req, res) => {
  await forwardJson(req, res, "GET");
});

app.post("/api/photos", async (req, res) => {
  await forwardJson(req, res, "POST");
});

app.delete("/api/photos/:id", async (req, res) => {
  await forwardJson(req, res, "DELETE");
});

app.get("/api/photos/:id/download", async (req, res) => {
  await forwardDownload(req, res);
});

// Backward-compatible image endpoint
app.get("/api/images/:id", async (req, res) => {
  try {
    const authQuery =
      typeof req.query.auth === "string" && req.query.auth.trim()
        ? `?auth=${encodeURIComponent(req.query.auth)}`
        : "";
    const response = await axios.get(
      `${PHOTO_SERVER_URL}/api/photos/${req.params.id}/download${authQuery}`,
      {
        responseType: "stream",
        headers: getForwardHeaders(req),
        validateStatus: () => true,
      }
    );
    if (response.status >= 400) {
      res.status(response.status).json({ error: "Request failed" });
      return;
    }
    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    if (response.headers["content-disposition"]) {
      res.setHeader("Content-Disposition", response.headers["content-disposition"]);
    }
    response.data.pipe(res);
  } catch (error) {
    console.error(`Proxy error [GET /api/images/${req.params.id}]`, error.message);
    res.status(503).json({ error: "Database server is down" });
  }
});

app.get("/uploads/:filename", async (req, res) => {
  await forwardAsset(req, res);
});

app.post("/api/auth/login", async (req, res) => {
  await forwardJson(req, res, "POST");
});

app.post("/api/auth/register", async (req, res) => {
  await forwardJson(req, res, "POST");
});

app.get("/api/auth/me", async (req, res) => {
  await forwardJson(req, res, "GET");
});

app.get("/api/health", async (_req, res) => {
  try {
    const upstream = await axios.get(`${PHOTO_SERVER_URL}/api/health`, {
      timeout: 2000,
      validateStatus: () => true,
    });
    if (upstream.status >= 200 && upstream.status < 300) {
      res.json({ ok: true, photoServer: "up" });
      return;
    }
    res.status(503).json({ ok: false, photoServer: "down" });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json({ ok: false, photoServer: "down" });
  }
});

app.listen(PORT, () => {
  console.log(`Image proxy server running on http://localhost:${PORT}`);
  console.log(`Photo server URL: ${PHOTO_SERVER_URL}`);
});
