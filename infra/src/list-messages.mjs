import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, json, TABLE_NAME } from "./_shared.mjs";

export async function handler(event) {
  if (!TABLE_NAME) return json(500, { message: "Server not configured" });

  // Protected by HTTP API JWT authorizer (Cognito). This is a defensive check in
  // case the route auth config is accidentally removed.
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (!claims) return json(401, { message: "Unauthorized" });

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

