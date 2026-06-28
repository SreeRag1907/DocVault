import { Router } from "express";
import { randomBytes } from "crypto";
import { pool } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { createUploadUrl, createDownloadUrl, getObjectBuffer, deleteObject } from "../lib/s3";
import { extractPdfText, summarizeText, summarizeImage, answerQuestion } from "../lib/ai";

const router = Router();

const PUBLIC_COLUMNS = `
  id, original_filename, mime_type, file_type, size_bytes,
  ai_summary, tags, is_favorite, share_token, created_at, updated_at
`;

/**
 * GET /api/documents?search=&tag=&favorite=true&sort=date|name|size&page=1&pageSize=24
 * Auth required. `search` runs against the generated tsvector column
 * (filename + extracted text + AI summary, ranked by relevance).
 * Returns { documents, total } - `total` is the full match count
 * (ignoring page/pageSize), so the frontend can render "Page 2 of 5".
 */
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const { search, tag, favorite, sort } = req.query as {
    search?: string;
    tag?: string;
    favorite?: string;
    sort?: "date" | "name" | "size";
  };
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 24));
  const ownerId = req.user!.id;

  const conditions: string[] = ["owner_id = $1"];
  const params: any[] = [ownerId];

  if (search) {
    params.push(search);
    conditions.push(`search_vector @@ plainto_tsquery('english', $${params.length})`);
  }
  if (tag) {
    params.push(tag);
    conditions.push(`$${params.length} = ANY(tags)`);
  }
  if (favorite === "true") {
    conditions.push("is_favorite = true");
  }

  const whereClause = conditions.join(" AND ");

  const sortColumn =
    sort === "name" ? "original_filename ASC" : sort === "size" ? "size_bytes DESC" : "created_at DESC";

  const orderBy = search
    ? `ts_rank(search_vector, plainto_tsquery('english', $2)) DESC`
    : sortColumn;

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM documents WHERE ${whereClause}`,
    params
  );

  const limitParamIndex = params.length + 1;
  const offsetParamIndex = params.length + 2;
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM documents WHERE ${whereClause}
     ORDER BY ${orderBy} LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
    [...params, pageSize, (page - 1) * pageSize]
  );

  res.json({ documents: rows, total: countRows[0].total, page, pageSize });
});

/**
 * GET /api/documents/stats
 * Auth required. Single aggregate query backing the dashboard's
 * summary bar - total documents, favorites, and storage used.
 * Registered before /:id routes so "stats" is never swallowed by the
 * :id param matcher.
 */
router.get("/stats", requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS "totalDocuments",
       COUNT(*) FILTER (WHERE is_favorite)::int AS "totalFavorites",
       COALESCE(SUM(size_bytes), 0)::bigint AS "totalSizeBytes"
     FROM documents WHERE owner_id = $1`,
    [req.user!.id]
  );

  res.json(rows[0]);
});

/**
 * GET /api/documents/:id
 * Auth required. Returns a single document's full details.
 */
router.get("/:id(\\d+)", requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM documents WHERE id = $1 AND owner_id = $2`,
    [req.params.id, req.user!.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found" });
  res.json({ document: rows[0] });
});

/** GET /api/documents/upload-url - presigned PUT for the browser to upload directly to S3. */
router.get("/upload-url", requireAuth, async (req, res) => {
  const filename = (req.query.filename as string) || "file.bin";
  const contentType = (req.query.contentType as string) || "application/octet-stream";

  const { uploadUrl, key } = await createUploadUrl(filename, contentType);
  res.json({ uploadUrl, key });
});

/**
 * POST /api/documents - called AFTER the browser has finished
 * uploading directly to S3, to record the file's metadata.
 */
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const { originalFilename, s3Key, mimeType, sizeBytes } = req.body as {
    originalFilename?: string;
    s3Key?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!originalFilename || !s3Key || !mimeType) {
    return res.status(400).json({ error: "originalFilename, s3Key, and mimeType are required" });
  }

  const fileType = mimeType === "application/pdf" ? "pdf" : "image";

  const { rows } = await pool.query(
    `INSERT INTO documents (owner_id, original_filename, s3_key, mime_type, file_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${PUBLIC_COLUMNS}`,
    [req.user!.id, originalFilename, s3Key, mimeType, fileType, sizeBytes || 0]
  );

  res.status(201).json({ document: rows[0] });
});

/** PATCH /api/documents/:id - rename, retag, or toggle favorite. */
router.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const { tags, isFavorite, originalFilename } = req.body as {
    tags?: string[];
    isFavorite?: boolean;
    originalFilename?: string;
  };

  const { rows } = await pool.query(
    `UPDATE documents SET
       tags = COALESCE($1, tags),
       is_favorite = COALESCE($2, is_favorite),
       original_filename = COALESCE($3, original_filename),
       updated_at = now()
     WHERE id = $4 AND owner_id = $5
     RETURNING ${PUBLIC_COLUMNS}`,
    [tags, isFavorite, originalFilename, req.params.id, req.user!.id]
  );

  if (rows.length === 0) return res.status(404).json({ error: "Document not found" });
  res.json({ document: rows[0] });
});

/** DELETE /api/documents/:id - removes the DB row and the S3 object. */
router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    "SELECT s3_key FROM documents WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found" });

  await deleteObject(rows[0].s3_key);
  await pool.query("DELETE FROM documents WHERE id = $1", [req.params.id]);
  res.status(204).send();
});

/** GET /api/documents/:id/download-url - short-lived signed link to view/download the file. */
router.get("/:id/download-url", requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    "SELECT s3_key FROM documents WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found" });

  const downloadUrl = await createDownloadUrl(rows[0].s3_key);
  res.json({ downloadUrl });
});

/**
 * POST /api/documents/:id/summarize - on demand, not automatic on
 * upload. Fetches the PDF or image from S3, extracts text or vision analysis,
 * calls the AI summary, and saves the result. Manual-trigger keeps this simple.
 */
router.post("/:id/summarize", requireAuth, async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    "SELECT s3_key, file_type, mime_type FROM documents WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found" });

  const { s3_key, file_type, mime_type } = rows[0];

  try {
    const buffer = await getObjectBuffer(s3_key);
    let summary = "";

    if (file_type === "pdf") {
      const text = await extractPdfText(buffer);
      if (!text) {
        return res.status(422).json({
          error: "Couldn't extract any text from this PDF - it may be a scanned image with no text layer.",
        });
      }
      summary = await summarizeText(text);

      await pool.query(
        `UPDATE documents SET extracted_text = $1, ai_summary = $2, updated_at = now()
         WHERE id = $3`,
        [text, summary, req.params.id]
      );
    } else if (file_type === "image") {
      summary = await summarizeImage(buffer, mime_type);

      await pool.query(
        `UPDATE documents SET ai_summary = $1, updated_at = now()
         WHERE id = $2`,
        [summary, req.params.id]
      );
    } else {
      return res.status(400).json({ error: "AI summaries are only available for PDF and image documents." });
    }

    const { rows: updated } = await pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM documents WHERE id = $1`,
      [req.params.id]
    );

    res.json({ document: updated[0] });
  } catch (err) {
    console.error("Summarization failed:", err);
    res.status(502).json({ error: "Summarization failed - the AI service may be unavailable." });
  }
});

/** POST /api/documents/:id/share - mints (or rotates) a public share token. */
router.post("/:id/share", requireAuth, async (req: AuthedRequest, res) => {
  const token = randomBytes(12).toString("hex");

  const { rows } = await pool.query(
    `UPDATE documents SET share_token = $1 WHERE id = $2 AND owner_id = $3
     RETURNING ${PUBLIC_COLUMNS}`,
    [token, req.params.id, req.user!.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Document not found" });

  res.json({ document: rows[0] });
});

/** DELETE /api/documents/:id/share - revokes the share link; old links stop working immediately. */
router.delete("/:id/share", requireAuth, async (req: AuthedRequest, res) => {
  await pool.query(
    "UPDATE documents SET share_token = NULL WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user!.id]
  );
  res.status(204).send();
});

/**
 * POST /api/documents/:id/chat
 * Chat with the document using historical context and current user query.
 */
router.post("/:id/chat", requireAuth, async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const { question, history } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT extracted_text, ai_summary, original_filename FROM documents WHERE id = $1 AND owner_id = $2",
      [id, req.user!.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const doc = rows[0];
    const context = doc.extracted_text || doc.ai_summary || "";

    if (!context) {
      return res.status(400).json({ 
        error: "This document has not been summarized yet and has no text content. Please generate a summary first before starting a chat." 
      });
    }

    const answer = await answerQuestion(doc.original_filename, context, question, history || []);
    res.json({ answer });
  } catch (err) {
    console.error("Chat with document failed:", err);
    res.status(502).json({ error: "Failed to communicate with AI chat service." });
  }
});

export default router;