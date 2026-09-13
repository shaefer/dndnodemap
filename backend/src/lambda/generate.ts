import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

// Placeholder handler for M0 scaffold. Replaced with the real
// generateMap()-backed implementation in M7 (see docs/overworld-map-app-spec-v2.md Section 14b).
export const handler = async (
  _event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "stub" }),
  };
};
