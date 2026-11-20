import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "portfolio-private-"));

describe("private attachments", () => {
  beforeAll(() => {
    process.env.PRIVATE_DIR = dir;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("stores real PDFs and images outside the public uploads", async () => {
    const { storeAttachments, getPrivateStorage } = await import("@/server/storage/private");
    const pdf = new File([Buffer.from("%PDF-1.7 test content")], "cahier des charges.pdf", { type: "application/pdf" });
    const [stored] = await storeAttachments([pdf]);
    expect(stored.mime).toBe("application/pdf");
    expect(stored.path).toMatch(/^attachments\/\d{4}\/\d{2}\/[a-f0-9]{32}\.pdf$/);
    expect(stored.name).toBe("cahier des charges.pdf");
    expect(await getPrivateStorage().stat(stored.path)).not.toBeNull();
  });

  it("rejects files whose real type is not allowed, whatever their name", async () => {
    const { storeAttachments, AttachmentError } = await import("@/server/storage/private");
    const fake = new File([Buffer.from("<?php system($_GET['c']); ?>")], "devis.pdf", { type: "application/pdf" });
    await expect(storeAttachments([fake])).rejects.toBeInstanceOf(AttachmentError);
    const svg = new File([Buffer.from("<svg onload=alert(1)>")], "logo.png", { type: "image/png" });
    await expect(storeAttachments([svg])).rejects.toMatchObject({ code: "fileType" });
  });

  it("limits the number of files", async () => {
    const { storeAttachments } = await import("@/server/storage/private");
    const files = Array.from({ length: 6 }, (_, index) => new File([Buffer.from("%PDF-1.7")], `f${index}.pdf`));
    await expect(storeAttachments(files)).rejects.toMatchObject({ code: "tooManyFiles" });
  });
});
