import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { getStoredFile } from "@/lib/file-store";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segs } = await ctx.params;
  const filePath = "/uploads/" + (segs ?? []).join("/");
  if (!filePath.startsWith("/uploads/") || filePath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const stored = await getStoredFile(filePath);
    if (stored?.data) {
      return new Response(new Uint8Array(stored.data), {
        headers: {
          "Content-Type": stored.mime,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": String(stored.data.length),
        },
      });
    }
    const row = await (prisma as unknown as {
      storedFile: { findUnique: (a: unknown) => Promise<{ mime: string; data: Buffer | Uint8Array } | null> };
    }).storedFile
      .findUnique({ where: { path: filePath } })
      .catch(() => null);
    if (row?.data) {
      const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data as unknown as Uint8Array);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": row.mime,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": String(buf.length),
        },
      });
    }
  } catch {}
  try {
    const rel = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    const abs = path.join(process.cwd(), "public", rel);
    const buf = await fs.readFile(abs);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(buf.length),
      },
    });
  } catch {}
  return new Response("Not found", { status: 404 });
}
