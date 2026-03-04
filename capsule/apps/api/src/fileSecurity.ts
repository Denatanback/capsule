import path from "path";

// Allowed MIME types whitelist
const ALLOWED_MIMES = new Set([
  // Images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text
  "text/plain", "text/csv", "text/markdown",
  // Archives
  "application/zip", "application/x-rar-compressed", "application/gzip",
  // Media
  "video/mp4", "video/webm", "audio/mpeg", "audio/ogg", "audio/wav",
  // Code (safe to store, never executed)
  "application/json",
]);

// Magic bytes signatures for real file type detection
const MAGIC_SIGNATURES: [number[], string][] = [
  [[0xFF, 0xD8, 0xFF], "image/jpeg"],
  [[0x89, 0x50, 0x4E, 0x47], "image/png"],
  [[0x47, 0x49, 0x46, 0x38], "image/gif"],
  [[0x52, 0x49, 0x46, 0x46], "image/webp"], // RIFF header (also used by wav)
  [[0x25, 0x50, 0x44, 0x46], "application/pdf"],
  [[0x50, 0x4B, 0x03, 0x04], "application/zip"], // ZIP (also docx/xlsx/pptx)
  [[0x1F, 0x8B], "application/gzip"],
  [[0x49, 0x44, 0x33], "audio/mpeg"], // ID3 tag
  [[0xFF, 0xFB], "audio/mpeg"], // MP3 sync
  [[0xFF, 0xF3], "audio/mpeg"],
  [[0x4F, 0x67, 0x67, 0x53], "audio/ogg"],
];

// Dangerous extensions that should never be executed
const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".ps1",
  ".sh", ".bash", ".csh", ".ksh", ".php", ".py", ".rb",
  ".pl", ".asp", ".aspx", ".jsp", ".htm", ".html", ".svg",
  ".dll", ".sys", ".drv", ".ocx",
]);

// Content-Disposition types: inline for safe previews, attachment for everything else
const INLINE_SAFE = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "video/mp4", "video/webm",
]);

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIMES.has(mime);
}

export function detectMimeFromBytes(buffer: Buffer): string | null {
  for (const [sig, mime] of MAGIC_SIGNATURES) {
    if (buffer.length >= sig.length) {
      let match = true;
      for (let i = 0; i < sig.length; i++) {
        if (buffer[i] !== sig[i]) { match = false; break; }
      }
      if (match) return mime;
    }
  }
  return null;
}

export function isDangerousExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return DANGEROUS_EXTENSIONS.has(ext);
}

export function sanitizeFilename(filename: string): string {
  // Remove path traversal, null bytes, control chars
  let clean = filename
    .replace(/\.\./g, "")
    .replace(/[\/]/g, "")
    .replace(/[\x00-\x1f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim();
  // Limit length
  if (clean.length > 200) {
    const ext = path.extname(clean);
    clean = clean.slice(0, 200 - ext.length) + ext;
  }
  return clean || "unnamed";
}

export function getContentDisposition(mime: string, filename: string): string {
  const safe = INLINE_SAFE.has(mime);
  const encoded = encodeURIComponent(filename);
  return safe
    ? "inline; filename*=UTF-8''" + encoded
    : "attachment; filename*=UTF-8''" + encoded;
}

export function validateUpload(
  buffer: Buffer,
  claimedMime: string,
  filename: string
): { ok: true; mime: string; filename: string } | { ok: false; error: string } {
  // Size check
  if (buffer.length > MAX_FILE_SIZE) {
    return { ok: false, error: "File too large (max 25MB)" };
  }

  // Dangerous extension check
  if (isDangerousExtension(filename)) {
    return { ok: false, error: "File type not allowed" };
  }

  // MIME whitelist check
  if (!isAllowedMime(claimedMime)) {
    return { ok: false, error: "File type not allowed: " + claimedMime };
  }

  // Magic bytes verification
  const detectedMime = detectMimeFromBytes(buffer);
  // For text/json files there are no magic bytes, trust claimed MIME if whitelisted
  // For binary files, verify magic bytes match
  if (detectedMime) {
    // ZIP-based formats (docx, xlsx, pptx) all have ZIP magic bytes
    const isZipBased = claimedMime.includes("officedocument") || claimedMime === "application/zip";
    if (isZipBased && detectedMime === "application/zip") {
      // OK: Office docs are ZIP files
    } else if (detectedMime !== claimedMime) {
      // Allow RIFF for both webp and wav
      if (!(detectedMime === "image/webp" && claimedMime === "audio/wav")) {
        return { ok: false, error: "File content does not match declared type" };
      }
    }
  }

  return {
    ok: true,
    mime: claimedMime,
    filename: sanitizeFilename(filename),
  };
}
