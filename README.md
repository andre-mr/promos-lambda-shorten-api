# 🔗 Lambda Shortlinks API

Serverless AWS Lambda that generates and stores short URLs in DynamoDB with API-key protection.

## 🚀 Overview

- Accepts a POST request with `domain` and `url`, validates the caller via `x-api-key`, and writes a new shortlink item to DynamoDB.
- Generates a collision-safe ID (or uses a provided test ID under `NODE_ENV=test`) and returns `https://{domain}/{id}`.
- Enforces an allowlist of domains and sets a TTL on each record for automatic expiry.
- Core logic lives in `src/controller.mjs`; the Lambda entry point is `src/index.mjs`.

## 🧰 Tech Stack

- Node.js (ESM) running on AWS Lambda.
- AWS SDK v3 (`@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`).
- Jest for unit/integration tests; `dotenv` for local configuration.

## ⚙️ Configuration

Set the following environment variables (see `.env` for an example):

- `API_KEY`: Shared secret expected in the `x-api-key` header.
- `AMAZON_ACCESS_KEY_ID` / `AMAZON_SECRET_ACCESS_KEY`: IAM credentials with DynamoDB write access.
- `AMAZON_REGION`: AWS region for DynamoDB.
- `AMAZON_DYNAMODB_TABLE`: Target table name.
- `AMAZON_DYNAMODB_TTL` (optional): TTL in seconds (default: `31536000`, ~1 year).
- `ALLOWED_DOMAINS`: JSON array of domains allowed for shortening (e.g., `["links.example.com"]`).

## 📦 Setup

- Install dependencies: `npm install`
- Create a `.env` file with the variables above.
- For quick manual checks, you can adjust and run `node dev/fetch-test.mjs` after setting your env values.

## ▶️ API Usage

**Endpoint (example):** `https://abc123xyz.lambda-url.sa-east-1.on.aws/`

**Request**

- Method: `POST`
- Headers: `Content-Type: application/json`, `x-api-key: super-secret-key`
- Body:
  ```json
  {
    "domain": "links.example.com",
    "url": "https://example.com/some/long/path"
  }
  ```

**Response (200)**

```json
{
  "shortUrl": "https://links.example.com/Ab3xYz"
}
```

**Quick Node.js example**

```js
import fetch from "node-fetch";

const endpoint = "https://abc123xyz.lambda-url.sa-east-1.on.aws/";
const apiKey = "super-secret-key";

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify({
    domain: "links.example.com",
    url: "https://example.com/pricing?ref=newsletter",
  }),
});

const data = await res.json();
console.log(data.shortUrl);
```

**Common errors**

- `400 Missing or invalid API key.` when `x-api-key` is absent or incorrect.
- `400 Missing url in request body.` when `url` is blank.
- `400 Missing domain in request.` or `400 Domain not allowed.` when `domain` is absent or outside `ALLOWED_DOMAINS`.
- `500 Could not persist shortlink.` when DynamoDB persistence fails.

## 🧪 Testing

- Run all tests: `npm test`
- Unit tests cover validation and error paths; an integration test will run only if all required AWS env vars and `API_KEY`/`ALLOWED_DOMAINS` are set (see `tests/index.test.mjs`).

## 🗂️ Project Structure

- `src/index.mjs` — Lambda handler that wraps responses.
- `src/controller.mjs` — Input parsing, domain allowlist enforcement, DynamoDB persistence, and short URL generation.
- `tests/index.test.mjs` — Validation and optional integration tests.
- `dev/fetch-test.mjs` — Simple manual invocation script for local experimentation.
