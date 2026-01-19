import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

process.env.NEXT_PUBLIC_API_URL = "http://localhost";

beforeAll(() => {
  server.listen({
    onUnhandledRequest(req, print) {
      const { pathname } = new URL(req.url);
      if (pathname.startsWith("/socket.io/")) {
        return;
      }
      print.error();
      throw new Error(`[MSW] Unhandled ${req.method} ${req.url}`);
    },
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
