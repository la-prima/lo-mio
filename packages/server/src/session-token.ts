import type { FastifyReply, FastifyRequest } from "fastify";
import "@fastify/cookie";

export const STAFF_COOKIE = "lomio_staff";
export const GUEST_COOKIE = "lomio_guest";

/** Token del personal: cookie (web) o `Authorization: Bearer` (app). */
export function staffTokenOf(req: FastifyRequest): string | undefined {
  const bearer = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  return bearer ?? req.cookies[STAFF_COOKIE];
}

export const guestTokenOf = (req: FastifyRequest): string | undefined => req.cookies[GUEST_COOKIE];

/** Cookie de sesión: httpOnly (JS no la lee), Secure (solo HTTPS) y SameSite=Lax (CSRF). */
export function setSessionCookie(
  reply: FastifyReply,
  name: string,
  token: string,
  maxAgeSeconds: number,
) {
  return reply.setCookie(name, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export const clearSessionCookie = (reply: FastifyReply, name: string) =>
  reply.clearCookie(name, { path: "/" });
