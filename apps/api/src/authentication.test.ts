import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { authenticationHook, type SchemeHandler } from "./authentication.ts";

const req = {} as FastifyRequest;
const reply = {} as FastifyReply;
const fail =
  (statusCode: number): SchemeHandler =>
  async () => {
    throw Object.assign(new Error(String(statusCode)), { statusCode });
  };
const pass: SchemeHandler = async () => {};

describe("Autenticación según el contrato", () => {
  it("una operación pública no lleva hook", () => {
    expect(authenticationHook(undefined, {})).toBeUndefined();
    expect(authenticationHook([{}], {})).toBeUndefined();
  });

  it("basta con que una alternativa pase (cookie o bearer)", async () => {
    const hook = authenticationHook([{ staffCookie: [] }, { staffBearer: [] }], {
      staffCookie: fail(401),
      staffBearer: pass,
    });
    await expect(hook?.(req, reply)).resolves.toBeUndefined();
  });

  it("si ninguna pasa y una autenticó sin el rol, responde 403 y no 401", async () => {
    const hook = authenticationHook([{ staffCookie: ["admin"] }, { staffBearer: ["admin"] }], {
      staffCookie: fail(401),
      staffBearer: fail(403),
    });
    await expect(hook?.(req, reply)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("no arranca si el contrato nombra un esquema sin handler", () => {
    expect(() => authenticationHook([{ guestSession: [] }], {})).toThrow(
      /guestSession del contrato no tiene handler/,
    );
  });
});
