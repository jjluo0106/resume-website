import crypto from "node:crypto";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, getSourceIp, json, TABLE_NAME } from "./_shared.mjs";

function safeJsonParse(str) {
  try {
    return JSON.parse(str ?? "{}");
  } catch {
    return null;
  }
}

function isEmail(value) {
  const v = String(value ?? "").trim();
  if (!v) return false;
  // simple practical check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function clampText(value, max) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return v.length > max ? v.slice(0, max) : v;
}

function rateBucket(ip, now) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  return `RATE#${ip}#${y}${m}${d}${h}`;
}

export async function handler(event) {
  if (!TABLE_NAME) return json(500, { message: "Server not configured" });

  const body = safeJsonParse(event?.body);
  if (!body) return json(400, { message: "Invalid JSON" });

  // Honeypot anti-spam: bots often fill hidden fields
  const honeypot = clampText(body.website ?? "", 120);
  if (honeypot) return json(200, { ok: true }); // pretend success to reduce retries

  const name = clampText(body.name, 60);
  const email = clampText(body.email, 120);
  const company = clampText(body.company, 80);
  const message = clampText(body.message, 2000);

  if (!name || !email || !message) {
    return json(400, { message: "Missing required fields" });
  }
  if (!isEmail(email)) {
    return json(400, { message: "Invalid email" });
  }

  const now = new Date();
  const ip = getSourceIp(event) || "unknown";

  // Basic rate limit: max 5 submissions per IP per hour
  const bucket = rateBucket(ip, now);
  const ratePk = bucket;
  const rateSk = "1";
  const ttl = Math.floor(now.getTime() / 1000) + 60 * 60 * 2; // keep 2 hours

  try {
    const rateRes = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: ratePk, sk: rateSk },
        UpdateExpression: "SET #ttl = :ttl ADD #c :one",
        ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: { ":one": 1, ":ttl": ttl },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const count = Number(rateRes?.Attributes?.count ?? 1);
    if (count > 5) return json(429, { message: "Too many requests" });
  } catch {
    // If rate limiting fails, continue; do not block legitimate users.
  }

  const id = crypto.randomUUID();
  const createdAt = now.toISOString();
  const pk = "MSG";
  const sk = `${createdAt}#${id}`;

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk,
        sk,
        id,
        createdAt,
        name,
        email,
        company: company || undefined,
        message,
        ip,
      },
    }),
  );

  return json(200, { ok: true });
}

