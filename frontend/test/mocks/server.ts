import { setupServer } from "msw/node";
import { taskHandlers } from "./handlers/tasks";
import { petHandlers } from "./handlers/pets";

export const server = setupServer(...taskHandlers, ...petHandlers);
