import { OnlineGameError, createOnlineGameService } from "@/game/online-service";
import { UpstashOnlineGameStore } from "@/game/upstash-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ roomCode: string }> };

function errorResponse(error: unknown) {
  if (error instanceof OnlineGameError) {
    const status = error.code === "ROOM_NOT_FOUND" ? 404 : error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json({ error: error.code }, { status, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ error: "ONLINE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { roomCode } = await context.params;
    const participantToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!participantToken) return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
    const input = body as Record<string, unknown>;
    const gameService = createOnlineGameService(new UpstashOnlineGameStore());
    if (input.action === "reconnect") {
      return Response.json(await gameService.reconnect(roomCode, participantToken), { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "set-secret" && typeof input.secret === "string") {
      return Response.json(await gameService.setSecret(roomCode, participantToken, input.secret), { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "guess" && typeof input.guess === "string") {
      return Response.json(await gameService.submitGuess(roomCode, participantToken, input.guess), { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "rematch") {
      return Response.json(await gameService.requestRematch(roomCode, participantToken), { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
