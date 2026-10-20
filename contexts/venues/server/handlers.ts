import { idempotencyKeyOf, replyCommand, staffOf } from "@lo-mio/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { NewProduct, NewTable } from "../contracts/index.ts";
import * as service from "./service.ts";

type Req<Body = unknown, Params = unknown> = FastifyRequest<{ Body: Body; Params: Params }>;

const command = (req: FastifyRequest) => ({ key: idempotencyKeyOf(req), log: req.log });

/** Handlers de contracts/openapi.yaml, por operationId. */
export const venuesHandlers = (deps: service.VenuesDeps) => ({
  getCurrentVenue: async (req: Req) => {
    const { id, name, country, currency } = await service.currentVenue(deps, staffOf(req));
    return { id, name, country, currency };
  },
  listTables: async (req: Req) => service.listTables(deps, staffOf(req)),
  registerTable: async (req: Req<NewTable>, reply: FastifyReply) =>
    replyCommand(reply, await service.addTable(deps, staffOf(req), req.body, command(req))),
  rotateTableQr: async (req: Req<unknown, { tableId: string }>, reply: FastifyReply) =>
    replyCommand(
      reply,
      await service.rotateTableQr(deps, staffOf(req), req.params.tableId, command(req)),
    ),
  listProducts: async (req: Req) => service.listProducts(deps, staffOf(req)),
  registerProduct: async (req: Req<NewProduct>, reply: FastifyReply) =>
    replyCommand(reply, await service.addProduct(deps, staffOf(req), req.body, command(req))),
});
