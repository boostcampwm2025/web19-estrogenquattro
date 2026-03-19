import { setupServer } from "msw/node";
import { taskHandlers } from "./handlers/tasks";
import { petHandlers } from "./handlers/pets";
import { guestbookHandlers } from "./handlers/guestbook";

export const server = setupServer(...taskHandlers, ...petHandlers, ...guestbookHandlers);
