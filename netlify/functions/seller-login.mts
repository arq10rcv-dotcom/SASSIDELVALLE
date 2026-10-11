import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

// LINE / SASSI — acceso con contraseña fija verificada solamente en Netlify.
// Aquí se guarda su hash scrypt, no la contraseña en texto claro.
// SELLER_SESSION_SECRET continúa siendo privado en Netlify para firmar las sesiones.
const PASSWORD_SALT = "ecb5f9be7d36d170d515521cfaadb257";
const PASSWORD_HASH = "69fac5a8bb873631f9599431228711e9acc185ebe7daa6b6259ddf07fee5bdfa";
const SESSION_HOURS = 12;
const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function normalizePassword(value: string): string {
  return String(value ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "");
}

function validConfiguration(): boolean {
  // Reutiliza la clave privada existente. Un valor de 16+ bytes habilita
  // sesiones firmadas; una clave aleatoria de 32+ bytes es recomendable.
  return Buffer.byteLength(process.env.SELLER_SESSION_SECRET || "", "utf8") >= 16;
}

function passwordMatches(raw: string): boolean {
  const input = normalizePassword(raw);
  const candidate = scryptSync(input, PASSWORD_SALT, 32);
  return timingSafeEqual(candidate, Buffer.from(PASSWORD_HASH, "hex"));
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
