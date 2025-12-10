import { createShortLink } from "./controller.mjs";

export const handler = async (event) => {
  try {
    const result = await createShortLink(event);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal server error.";

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    };
  }
};
