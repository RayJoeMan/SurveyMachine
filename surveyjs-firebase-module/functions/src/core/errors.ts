import { HttpsError } from "firebase-functions/v2/https";
import type { ZodType } from "zod";

export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpsError("invalid-argument", "The request payload is invalid.", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

export function assertJsonSize(value: unknown, maximumBytes: number, label: string): void {
  const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (bytes > maximumBytes) {
    throw new HttpsError("invalid-argument", `${label} exceeds the ${maximumBytes}-byte limit.`);
  }
}
