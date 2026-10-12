import { insertAdminSession, insertStaffUser } from "../support/database-access/rows.js";
import type { ConstraintCase } from "./constraint-case.js";

// The administration login: the e-mail of an account and the sessions (migration add_admin_sessions).
export const adminConstraintCases: ConstraintCase[] = [
  {
    constraint: "ck_staff_user_email_form",
    accepted: [
      { name: "a driver without an e-mail", run: (db) => insertStaffUser(db, { email: null }) },
      {
        name: "a normalised e-mail",
        run: (db) => insertStaffUser(db, { email: "ana.rakoto@example.mg" }),
      },
    ],
    rejected: [
      {
        name: "an e-mail with an upper case letter",
        run: (db) => insertStaffUser(db, { email: "Ana@example.mg" }),
      },
      {
        name: "an e-mail with a surrounding space",
        run: (db) => insertStaffUser(db, { email: " ana@example.mg" }),
      },
      {
        name: "an e-mail without an @",
        run: (db) => insertStaffUser(db, { email: "ana.example" }),
      },
      { name: "an empty e-mail", run: (db) => insertStaffUser(db, { email: "" }) },
      {
        name: "an e-mail of 255 characters",
        run: (db) => insertStaffUser(db, { email: `${"a".repeat(251)}@b.c` }),
      },
    ],
  },
  {
    constraint: "ck_admin_session_token_hash_form",
    accepted: [{ name: "a SHA-256 in hexadecimal", run: (db) => insertAdminSession(db) }],
    rejected: [
      {
        name: "a hash in upper case",
        run: (db) => insertAdminSession(db, { token_hash: "A".repeat(64) }),
      },
      {
        name: "a hash of 63 characters",
        run: (db) => insertAdminSession(db, { token_hash: "a".repeat(63) }),
      },
      {
        name: "a token in base64url, which is what must never be stored",
        run: (db) => insertAdminSession(db, { token_hash: "A".repeat(43) }),
      },
    ],
  },
  {
    constraint: "ck_admin_session_expires_after_creation",
    accepted: [{ name: "a session that ends after it began", run: (db) => insertAdminSession(db) }],
    rejected: [
      {
        name: "a session that ends when it begins",
        run: (db) =>
          insertAdminSession(db, {
            created_at: new Date("2026-10-12T08:00:00.000Z"),
            expires_at: new Date("2026-10-12T08:00:00.000Z"),
          }),
      },
    ],
  },
  {
    constraint: "ck_admin_session_last_seen_not_before_creation",
    accepted: [
      {
        name: "a session seen at its creation",
        run: (db) => insertAdminSession(db, { last_seen_at: new Date("2026-10-12T08:00:00.000Z") }),
      },
    ],
    rejected: [
      {
        name: "a session seen before it was created",
        run: (db) => insertAdminSession(db, { last_seen_at: new Date("2026-10-12T07:59:59.000Z") }),
      },
    ],
  },
  {
    constraint: "ck_admin_session_revoked_not_before_creation",
    accepted: [
      { name: "a session that was never revoked", run: (db) => insertAdminSession(db) },
      {
        name: "a session revoked after its creation",
        run: (db) => insertAdminSession(db, { revoked_at: new Date("2026-10-12T09:00:00.000Z") }),
      },
    ],
    rejected: [
      {
        name: "a session revoked before it was created",
        run: (db) => insertAdminSession(db, { revoked_at: new Date("2026-10-12T07:00:00.000Z") }),
      },
    ],
  },
];
