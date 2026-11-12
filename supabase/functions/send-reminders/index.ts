import { createReminderHandler } from "./handler.mjs";

Deno.serve(createReminderHandler({ env: (key: string) => Deno.env.get(key) }));
