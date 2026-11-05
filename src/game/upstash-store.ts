import type { OnlineGameRecord, OnlineGameStore } from "./online-service.ts";

const roomTtlSeconds = 60 * 60;
const compareAndSwapScript = `
local value = redis.call("GET", KEYS[1])
if not value then return 0 end
local record = cjson.decode(value)
if tonumber(record.revision) ~= tonumber(ARGV[1]) then return 0 end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

type RedisReply<T> = { result?: T; error?: string };

export class UpstashOnlineGameStore implements OnlineGameStore {
  private readonly endpoint: string;
  private readonly token: string;

  constructor(endpoint = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!endpoint || !token) throw new Error("Online storage is not configured");
    this.endpoint = endpoint.replace(/\/$/, "");
    this.token = token;
  }

  private async command<T>(...command: Array<string | number>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Online storage request failed");
    const payload = await response.json() as RedisReply<T>;
    if (payload.error) throw new Error("Online storage command failed");
    return payload.result as T;
  }

  async get(roomCode: string): Promise<OnlineGameRecord | undefined> {
    const value = await this.command<string | null>("GET", `code-caper:room:v2:${roomCode}`);
    return value ? JSON.parse(value) as OnlineGameRecord : undefined;
  }

  async create(record: OnlineGameRecord): Promise<void> {
    const result = await this.command<string | null>("SET", `code-caper:room:v2:${record.roomCode}`, JSON.stringify(record), "EX", roomTtlSeconds, "NX");
    if (!result) throw new Error("Online room code collision");
  }

  async compareAndSwap(record: OnlineGameRecord, expectedRevision: number): Promise<boolean> {
    const updated = await this.command<number>(
      "EVAL", compareAndSwapScript, 1, `code-caper:room:v2:${record.roomCode}`,
      expectedRevision, JSON.stringify(record), roomTtlSeconds,
    );
    return updated === 1;
  }
}
