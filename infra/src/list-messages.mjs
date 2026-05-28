import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, json, TABLE_NAME } from "./_shared.mjs";

export async function handler(event) {
  if (!TABLE_NAME) return json(500, { message: "Server not configured" });

  const expected = process.env.ADMIN_KEY || "";
  const provided =
    event?.headers?.["x-admin-key"] ||
    event?.headers?.["X-Admin-Key"] ||
    event?.headers?.["x-admin-key".toUpperCase()] ||
    "";
  if (!expected || provided !== expected) {
    return json(401, { message: "Unauthorized" });
  }

  const limitRaw =
    event?.queryStringParameters?.limit || event?.queryStringParameters?.["limit"];
  const limit = Math.min(Math.max(Number(limitRaw || 30) || 30, 1), 100);

  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": "MSG" },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  const items = (res.Items || []).map((x) => ({
    id: x.id,
    createdAt: x.createdAt,
    name: x.name,
    email: x.email,
    company: x.company,
    message: x.message,
  }));

  return json(200, { items });
}

