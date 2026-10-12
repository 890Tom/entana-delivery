import { describe, expect, it } from "vitest";
import { isAdminPath } from "./is-admin-path.js";

describe("isAdminPath", () => {
  it.each([
    "/api/v1/admin",
    "/api/v1/admin/",
    "/api/v1/admin/auth/me",
    "/API/V1/ADMIN/auth/me",
    "/api/v1/Admin/orders/",
    "/api//v1///admin/orders",
    "/api/v1/%61dmin/orders",
    "/api/v1/admin%2Forders",
  ])("treats %s as the administration", (path) => {
    expect(isAdminPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/api/v1/tracking",
    "/api/v1/administrator",
    "/api/v1/products/admin",
    "/api/v2/admin",
    "/api/v1/admin%zz",
  ])("does not treat %s as the administration", (path) => {
    expect(isAdminPath(path)).toBe(false);
  });
});
