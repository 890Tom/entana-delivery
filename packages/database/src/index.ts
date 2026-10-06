// Public surface of @entana/database: the client factory and the types the API needs.
// The generated folder is deliberately not re-exported as a whole.
export { classifyDatabaseError, DATABASE_ERROR_KINDS } from "./classify-database-error.ts";
export type { DatabaseErrorKind } from "./classify-database-error.ts";
export { createPrismaClient } from "./create-prisma-client.ts";
export { InvalidDatabaseOptionsError } from "./pool-settings.ts";
export type { DatabaseClientOptions } from "./pool-settings.ts";
export type { PrismaClient } from "./generated/client.ts";
export type {
  AuditLog,
  AxisPlace,
  Customer,
  CustomerOrder,
  DeliveryAxis,
  OrderEvent,
  OrderItem,
  Place,
  Product,
  Reseller,
  ShopSetting,
  StaffUser,
} from "./generated/client.ts";
export * from "./generated/enums.ts";
