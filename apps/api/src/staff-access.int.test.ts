import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, PASSWORD, startApi } from "./testing.ts";

describe("Acceso del personal", () => {
  let api: Awaited<ReturnType<typeof startApi>>;
  let venueA: string;

  beforeAll(async () => {
    api = await startApi();
    venueA = await api.newVenue("Bar A");
  });
  afterAll(() => api.stop());

  it("el personal inicia sesión: recibe un token y una cookie segura de 12 horas", async () => {
    const { email } = await api.staff(venueA, "waiter");
    const res = await api.app.inject({
      method: "POST",
      url: "/v1/staff/sessions",
      payload: { email, password: PASSWORD },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ staff: { role: "waiter", venueId: venueA } });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/^lomio_staff=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=43200/);
  });

  it("un email inexistente y una contraseña incorrecta responden igual", async () => {
    const { email } = await api.staff(venueA, "waiter");
    const wrong = await api.app.inject({
      method: "POST",
      url: "/v1/staff/sessions",
      payload: { email, password: "otra-clave-larga" },
    });
    const unknown = await api.app.inject({
      method: "POST",
      url: "/v1/staff/sessions",
      payload: { email: "nadie@x.cl", password: PASSWORD },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
  });

  it("la sesión sirve con la cookie (web) o con Bearer (app) y se cierra de inmediato", async () => {
    const { token } = await api.staff(venueA, "manager");
    const viaCookie = await api.app.inject({
      method: "GET",
      url: "/v1/staff/sessions/current",
      cookies: { lomio_staff: token },
    });
    expect(viaCookie.json()).toMatchObject({ staff: { role: "manager" } });
    expect(
      (
        await api.app.inject({
          method: "DELETE",
          url: "/v1/staff/sessions/current",
          headers: bearer(token),
        })
      ).statusCode,
    ).toBe(204);
    const after = await api.app.inject({
      method: "GET",
      url: "/v1/staff/sessions/current",
      headers: bearer(token),
    });
    expect(after.statusCode).toBe(401);
    expect(after.headers["content-type"]).toContain("application/problem+json");
  });

  it("una sesión vencida responde 401 para que el dispositivo pida autenticarse de nuevo", async () => {
    const { token } = await api.staff(venueA, "waiter");
    await api.db
      .updateTable("staff_sessions" as never)
      .set({ expires_at: new Date(Date.now() - 1000) } as never)
      .execute();
    const res = await api.app.inject({
      method: "GET",
      url: "/v1/venues/current",
      headers: bearer(token),
    });
    expect(res.statusCode).toBe(401);
  });

  it("una operación de administración rechaza al mesero con 403", async () => {
    const { token } = await api.staff(venueA, "waiter");
    const res = await api.app.inject({
      method: "POST",
      url: "/v1/venues/current/tables",
      headers: { ...bearer(token), "idempotency-key": crypto.randomUUID() },
      payload: { label: "9" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ type: "https://lo-mio.cl/problems/forbidden" });
  });

  it("el login tiene su propio límite de intentos", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (
        await api.app.inject({
          method: "POST",
          url: "/v1/staff/sessions",
          payload: { email: "fuerza@bruta.cl", password: "x" },
        })
      ).statusCode;
    }
    expect(last).toBe(429);
  });
});
