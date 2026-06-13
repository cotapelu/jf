#!/usr/bin/env node
import { main } from "./main.js";
main().catch((err: unknown) => {
    console.error("Fatal:", err);
    process.exit(1);
});
