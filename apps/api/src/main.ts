import { bootstrap } from "./bootstrap.js";

process.exitCode = await bootstrap(process.env, process.stderr);
