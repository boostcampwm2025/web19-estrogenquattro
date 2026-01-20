import { setupServer } from "msw/node";
import { taskHandlers } from "./handlers/tasks";

export const server = setupServer(...taskHandlers);
