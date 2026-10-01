import { test, expect } from "@playwright/test";
function textPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf +=
    `xref\n0 6\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test("extracts a text PDF and rejects invalid uploads", async ({ request }) => {
  const workspace = await (
    await request.post("/api/workspaces", {
      data: { name: "PDF ingestion test" },
    })
  ).json();
  const response = await request.post("/api/documents", {
    multipart: {
      workspaceId: workspace.id,
      file: {
        name: "queue.pdf",
        mimeType: "application/pdf",
        buffer: textPdf("Queue latency target is 250 milliseconds."),
      },
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  expect((await response.json()).content).toContain("Queue latency");
  const invalid = await request.post("/api/documents", {
    multipart: {
      workspaceId: workspace.id,
      file: {
        name: "broken.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a pdf"),
      },
    },
  });
  expect(invalid.status()).toBe(400);
  const executable = await request.post("/api/documents", {
    multipart: {
      workspaceId: workspace.id,
      file: {
        name: "run.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not executable"),
      },
    },
  });
  expect(executable.status()).toBe(400);
});
