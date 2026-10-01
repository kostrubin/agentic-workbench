import { z } from "zod";
import { ingest } from "@/server/db/repository";
import { nativeTools } from "@/server/tools/registry";
import { apiError, guard, bodyBytes, HttpError } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    guard(request);
    const bytes = await bodyBytes(request, 3 * 1024 * 1024);
    const form = await new Response(bytes as BodyInit, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    const workspaceId = z.uuid().parse(form.get("workspaceId"));
    const file = form.get("file");
    let title = String(form.get("title") ?? "").trim(),
      content = String(form.get("content") ?? ""),
      kind = "note";
    if (file instanceof File && file.size) {
      if (file.size > 2 * 1024 * 1024)
        throw new HttpError("Files must be smaller than 2 MB.", 413);
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (!extension || !["txt", "md", "pdf"].includes(extension))
        throw new HttpError("Use a .txt, .md, or .pdf file.");
      title = file.name.replace(/[/\\\u0000-\u001f]/g, "_").slice(0, 180);
      kind = extension;
      const data = new Uint8Array(await file.arrayBuffer());
      if (extension === "pdf") {
        if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-")
          throw new HttpError("The file is not a valid PDF.");
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data });
        try {
          const info = await parser.getInfo();
          if (info.total > 100)
            throw new HttpError("PDFs are limited to 100 pages.");
          content = (await parser.getText()).text;
        } catch (error) {
          if (error instanceof HttpError) throw error;
          throw new HttpError(
            "Could not read this PDF. Try a text-based, unencrypted PDF.",
          );
        } finally {
          await parser.destroy();
        }
      } else {
        content = new TextDecoder("utf-8", { fatal: true }).decode(data);
      }
    }
    z.string().min(1).max(180).parse(title);
    if (content.trim().length < 10 || content.length > 150000)
      throw new HttpError(
        "Add 10–150,000 characters of readable text. Scanned PDFs require OCR elsewhere.",
      );
    return Response.json(
      kind === "note"
        ? await nativeTools(workspaceId).createNote.execute(
            { title, content },
            request.signal,
          )
        : await ingest(workspaceId, title, content, kind),
      {
        status: 201,
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
