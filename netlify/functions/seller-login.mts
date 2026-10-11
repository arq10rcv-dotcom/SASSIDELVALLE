import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

// Hash scrypt de la contraseña de vendedor. La contraseña nunca viaja al navegador.
// Para cambiarla sin tocar código, define la variable de entorno SELLER_PASSWORD en Netlify.
const PASSWORD_SALT = "a2a1a16a753860f2efdb3d571dff5e1b";
const PASSWORD_HASH = "47ff8a54312c9d2b7462cc6f2ff758106d9d0928c8d54010dd973edfdbf12685";
const SESSION_HOURS = 12;

function sessionSecret() {
  return process.env.SELLER_SESSION_SECRET || process.env.SELLER_PASSWORD || PASSWORD_HASH;
}

// Ignora mayúsculas/minúsculas y espacios: "NO LE VOY A PARAR", "no le voy a parar" y "nolevoyaparar" son equivalentes.
function normalizePassword(value: string) {
  return String(value ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "");
}

function passwordMatches(rawInput: string) {
  const input = normalizePassword(rawInput);
  const envPassword = process.env.SELLER_PASSWORD ? normalizePassword(process.env.SELLER_PASSWORD) : "";
  if (envPassword) {
    const a = createHmac("sha256", "cmp").update(input).digest();
    const b = createHmac("sha256", "cmp").update(envPassword).digest();
    return timingSafeEqual(a, b);
  }
  const candidate = scryptSync(input, PASSWORD_SALT, 32);
  return timingSafeEqual(candidate, Buffer.from(PASSWORD_HASH, "hex"));
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function issueToken() {
  const payload = Buffer.from(JSON.stringify({ role: "seller", exp: Date.now() + SESSION_HOURS * 3600_000 })).toString("base64url");
  return payload + "." + sign(payload);
}

function verifyToken(token: string) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "seller" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

const noStore = { "Cache-Control": "no-store" };

export default async (req: Request) => {
  if (req.method === "GET") {
    const auth = req.headers.get("authorization") || "";
    const ok = verifyToken(auth.replace(/^Bearer\s+/i, ""));
    return Response.json({ ok }, { status: ok ? 200 : 401, headers: noStore });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let password = "";
  try {
    password = String((await req.json())?.password ?? "").trim();
  } catch {}
  if (password && password.length <= 200 && passwordMatches(password)) {
    return Response.json({ ok: true, token: issueToken() }, { headers: noStore });
  }
  // Pausa breve para frenar intentos repetidos.
  await new Promise((r) => setTimeout(r, 800));
  return Response.json({ ok: false }, { status: 401, headers: noStore });
};

export const config = {
  path: "/api/seller-login",
  method: ["GET", "POST"],
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
