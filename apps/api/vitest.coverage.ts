// Shared by the unit and the integration configurations, so that both measure the same files.
export const coverageSettings = {
  provider: "v8" as const,
  // Unit, end-to-end and integration tests are merged: wiring files (modules, controllers) are
  // exercised by booting the real application, database code by the real PostgreSQL.
  include: ["src/**/*.ts"],
  // main.ts only reads process.env and starts listening: the tests boot the application
  // through createApplication instead.
  // src/cli/admin-upsert.ts is the same kind of file: it reads the terminal and the environment and
  // calls the tested modules next to it.
  exclude: ["src/**/*.test.ts", "src/main.ts", "src/cli/admin-upsert.ts"],
};
