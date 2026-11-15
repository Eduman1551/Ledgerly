// POST /api/import/parse-file (multipart "file") → plain text from .txt/.md/.docx.
import { route } from "@/lib/api";
import { badRequest } from "@/lib/services/errors";

const MAX_BYTES = 2 * 1024 * 1024;

export const POST = route(async (request) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Attach a file.");
  if (file.size > MAX_BYTES) throw badRequest("The file is larger than 2 MB.");
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) return { text: (await file.text()).trim() };
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) });
    return { text: result.value.trim() };
  }
  throw badRequest("Only .txt, .md and .docx files are supported in this version.");
});
