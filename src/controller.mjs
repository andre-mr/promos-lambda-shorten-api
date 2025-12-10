import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

let docClient = null;
let amazonTable = null;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const parseJsonBody = (rawBody) => {
  if (!rawBody) return {};

  if (typeof rawBody === "string") {
    try {
      return JSON.parse(rawBody);
    } catch (_) {
      throw new HttpError(400, "Invalid JSON body.");
    }
  }

  if (typeof rawBody === "object") {
    return rawBody;
  }

  throw new HttpError(400, "Unsupported body format.");
};

const normalizeHeaders = (event = {}) => {
  const baseHeaders = event.headers || event.rawEvent?.headers || {};
  return Object.entries(baseHeaders).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});
};

const getAllowedDomains = () => {
  try {
    const parsed = JSON.parse(process.env.ALLOWED_DOMAINS || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const generateRandomId = (size) => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < size; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

export const initializeClient = (event = {}) => {
  const {
    AMAZON_ACCESS_KEY_ID,
    AMAZON_SECRET_ACCESS_KEY,
    AMAZON_REGION,
    AMAZON_DYNAMODB_TABLE: eventTable,
  } = event.credentials || {};

  amazonTable = eventTable || process.env.AMAZON_DYNAMODB_TABLE;
  if (!amazonTable) {
    throw new HttpError(500, "Missing DynamoDB table configuration.");
  }

  const clientOptions = {};
  const region = AMAZON_REGION || process.env.AMAZON_REGION;
  if (region) {
    clientOptions.region = region;
  }

  const accessKeyId = AMAZON_ACCESS_KEY_ID || process.env.AMAZON_ACCESS_KEY_ID;
  const secretAccessKey = AMAZON_SECRET_ACCESS_KEY || process.env.AMAZON_SECRET_ACCESS_KEY;
  if (accessKeyId && secretAccessKey) {
    clientOptions.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }

  const client = new DynamoDBClient(clientOptions);
  docClient = DynamoDBDocumentClient.from(client);
};

export const createShortLink = async (event = {}) => {
  const headers = normalizeHeaders(event);
  const headerApiKey = headers["x-api-key"];
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey || !headerApiKey || headerApiKey !== expectedApiKey) {
    throw new HttpError(400, "Missing or invalid API key.");
  }

  const payload = parseJsonBody(event.body ?? event.rawEvent?.body);
  const requestedDomain = typeof payload.domain === "string" ? payload.domain.trim() : "";
  const incomingUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  const requestedTestId =
    process.env.NODE_ENV === "test" && typeof payload.testid === "string" ? payload.testid.trim() : "";

  if (!incomingUrl) {
    throw new HttpError(400, "Missing url in request body.");
  }

  const allowedDomains = getAllowedDomains();

  if (!requestedDomain) {
    throw new HttpError(400, "Missing domain in request.");
  }

  if (allowedDomains.length && !allowedDomains.includes(requestedDomain)) {
    throw new HttpError(400, "Domain not allowed.");
  }

  initializeClient(event);

  if (!docClient) {
    throw new HttpError(500, "DynamoDB client not initialized.");
  }

  const ttlFromEnv = Number(process.env.AMAZON_DYNAMODB_TTL);
  const ttl = Number.isFinite(ttlFromEnv) && ttlFromEnv > 0 ? ttlFromEnv : 31536000;

  const id = requestedTestId || generateRandomId(6);
  const primaryKey = `${requestedDomain}#${id}`;
  const createdDate = new Date().toISOString();

  const item = {
    PK: primaryKey,
    Clicks: 0,
    Created: createdDate,
    Domain: requestedDomain,
    TTL: ttl,
    Url: incomingUrl,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: amazonTable,
        Item: item,
        ...(!requestedTestId && {
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      })
    );
  } catch (error) {
    console.error("Error saving shortlink:", error);
    throw new HttpError(500, "Could not persist shortlink.");
  }

  const generatedShortUrl = `https://${requestedDomain}/${id}`;
  console.log("shortUrl, originalUrl, dateTime:", generatedShortUrl, incomingUrl, createdDate);
  return {
    shortUrl: generatedShortUrl,
  };
};

export { HttpError };
