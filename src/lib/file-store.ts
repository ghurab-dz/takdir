// Persistent file store for Render free tier (ephemeral filesystem).
// Every upload/render is saved to DB (Neon bytea) + filesystem for speed.
// API route /api/uploads serves from DB fallback, so images survive restarts/deploys.

import { prisma } from "./db";

export async function saveStoredFile(opts: { path: string; mime: string; buffer: Buffer; estimateId?: string | null }) {
  const { path: p, mime, buffer, estimateId } = opts;
  // upsert by path — idempotent on re-render
  try {
    await (prisma as unknown as { storedFile: { upsert: (a: unknown) => Promise<unknown> } }).storedFile.upsert({
      where: { path: p },
      create: { path: p, mime, data: buffer, estimateId: estimateId ?? null },
      update: { mime, data: buffer, estimateId: estimateId ?? null },
    });
  } catch (e) {
    // fallback: try create (if upsert not supported in mock)
    try {
      await (prisma as unknown as { storedFile: { create: (a: unknown) => Promise<unknown> } }).storedFile.create({
        data: { path: p, mime, data: buffer, estimateId: estimateId ?? null },
      });
    } catch {
      console.warn("[file-store] save failed", p, e);
    }
  }
}

export async function getStoredFile(filePath: string): Promise<{ mime: string; data: Buffer } | null> {
  try {
    const row = await (prisma as unknown as { storedFile: { findUnique: (a: unknown) => Promise<{ mime: string; data: Buffer | Uint8Array } | null> } }).storedFile.findUnique({
      where: { path: filePath },
    });
    if (!row) return null;
    const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data as unknown as Uint8Array);
    return { mime: row.mime, data: buf };
  } catch {
    return null;
  }
}

export async function deleteStoredFilesForEstimate(estimateId: string) {
  try {
    await (prisma as unknown as { storedFile: { deleteMany: (a: unknown) => Promise<unknown> } }).storedFile.deleteMany({
      where: { estimateId } as unknown as Record<string, unknown>,
    });
  } catch {}
}
