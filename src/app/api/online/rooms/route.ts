import { OnlineGameError, createOnlineGameService } from "@/game/online-service";
import { UpstashOnlineGameStore } from "@/game/upstash-store";
import type { Difficulty, SecretLength } from "@/game/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function service() {
  return createOnlineGameService(new UpstashOnlineGameStore());
}

function errorResponse(error: unknown) {
  if (error instanceof OnlineGameError) {
    const status = error.code === "ROOM_NOT_FOUND" ? 404 : error.code === "ROOM_FULL" ? 409 : 400;
    return Response.json({ error: error.code }, { status, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ error: "ONLINE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
    const input = body as Record<string, unknown>;
    const gameService = service();
    if (input.action === "create" && typeof input.name === "string" && (input.secretLength === 4 || input.secretLength === 5) && (input.difficulty === "classic" || input.difficulty === "medium" || input.difficulty === "mystery")) {
      return Response.json(await gameService.createRoom(input.name, input.secretLength as SecretLength, input.difficulty as Difficulty), { headers: { "Cache-Control": "no-store" } });
    }
    if (input.action === "join" && typeof input.roomCode === "string" && /^[A-Z0-9]{6,8}$/.test(input.roomCode) && typeof input.name === "string") {
      return Response.json(await gameService.joinRoom(input.roomCode, input.name), { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
