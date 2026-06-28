import { Router } from "express";
import { pool } from "../db";
import { createDownloadUrl } from "../lib/s3";

const router = Router();

/**
 * GET /api/share/:token - public, no Authorization header.
 *
 * Deliberately returns only the minimum needed to view one file: it
 * does NOT expose owner_id, tags, or any way to discover the user's
 * other documents. A document is reachable here only if its
 * share_token is set - revoking the share (DELETE .../share) makes
 * this 404 immediately for anyone holding the old link.
 */
router.get("/:token", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, original_filename, mime_type, file_type, ai_summary, s3_key
     FROM documents WHERE share_token = $1`,
    [req.params.token]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "This link is invalid or has been revoked." });
  }

  const doc = rows[0];
  const downloadUrl = await createDownloadUrl(doc.s3_key, 300);

  res.json({
    document: {
      id: doc.id,
      originalFilename: doc.original_filename,
      mimeType: doc.mime_type,
      fileType: doc.file_type,
      aiSummary: doc.ai_summary,
    },
    downloadUrl,
  });
});

export default router;
