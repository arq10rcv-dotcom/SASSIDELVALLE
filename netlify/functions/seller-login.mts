import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

// LINE / SASSI — autenticacion de vendedor.
// No poner contrasenas, hashes conocidos ni secretos de sesion en archivos publicos.
// Configurar en el servidor:
//   SELLER_PASSWORD o (SELLER_PASSWORD_SALT + SELLER_PASSWORD_HASH)
//   SELLER_SESSION_SECRET (minimo 32 bytes, independiente de la contrasena).
// Si falta la configuracion, el acceso permanece bloqueado.
const SESSION_HOURS = 12;
const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function normalizePassword(value: string): string {
  return String(value ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "");
}

function validConfiguration(): boolean {
  const secret = process.env.SELLER_SESSION_SECRET || "";
  const plain = process.env.SELLER_PASSWORD || "";
  const salt = process.env.SELLER_PASSWORD_SALT || "";
  const hash = process.env.SELLER_PASSWORD_HASH || "";
  const hasPassword = Boolean(plain) || (/^[a-f0-9]{32,}$/i.test(salt) && /^[a-f0-9]{64}$/i.test(hash));
  return Buffer.byteLength(secret, "utf8") >= 32 && hasPassword;
}

function passwordMatches(raw: string): boolean {
  const input = normalizePassword(raw);
  const plain = process.env.SELLER_PASSWORD || "";
  if (plain) {
    const candidate = createHmac("sha256", "seller-compare").update(input).digest();
    const expected = createHmac("sha256", "seller-compare").update(normalizePassword(plain)).digest();
    return timingSafeEqual(candidate, expected);
  }
  const salt = process.env.SELLER_PASSWORD_SALT || "";
  const hash = process.env.SELLER_PASSWORD_HASH || "";
  if (!/^[a-f0-9]{32,}$/i.test(salt) || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  const candidate = scryptSync(input, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

function sign(payload: string): string {
  return createHmac("sha256", process.env.SELLER_SESSION_SECRET!).update(payload).digest("base64url");
}

function issueToken(): string {
  const payload = Buffer.from(JSON.stringify({
    role: "seller",
    exp: Date.now() + SESSION_HOURS * 3_600_000,
  })).toString("base64url");
  return payload + "." + sign(payload);
}

function verifyToken(token: string): boolean {
  if (!token || token.length > 2048) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "seller" && Number.isFinite(data.exp) && data.exp > Date.now();
  } catch {
    return false;
  }
}

export default async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...noStore, Allow: "GET, POST" },
    });
  }
  if (!validConfiguration()) {
    return Response.json({ ok: false, error: "not_configured" }, {
      status: 503,
      headers: noStore,
    });
  }
  if (req.method === "GET") {
    const auth = req.headers.get("authorization") || "";
    const ok = verifyToken(auth.replace(/^Bearer\s+/i, ""));
    return Response.json({ ok }, {
      status: ok ? 200 : 401,
      headers: noStore,
    });
  }
  let password = "";
  try {
    password = String((await req.json())?.password ?? "").trim();
  } catch {
    // JSON invalido.
  }
  if (password && password.length <= 200 && passwordMatches(password)) {
    return Response.json({ ok: true, token: issueToken() }, { headers: noStore });
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  return Response.json({ ok: false }, { status: 401, headers: noStore });
};

export const config = {
  path: "/api/seller-login",
  method: ["GET", "POST"],
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
