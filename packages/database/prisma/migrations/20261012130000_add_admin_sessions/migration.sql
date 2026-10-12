-- Administration login: an e-mail on staff_user and the admin_session table (ADR 0017).
-- The generated part is the output of prisma migrate diff; the CHECK constraints are written by
-- hand because Prisma cannot express them (ADR 0007).

-- AlterTable
ALTER TABLE "staff_user" ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "admin_session" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "token_hash" TEXT NOT NULL,
    "staff_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "admin_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_session_token_hash_key" ON "admin_session"("token_hash");

-- CreateIndex
CREATE INDEX "admin_session_staff_user_id_idx" ON "admin_session"("staff_user_id");

-- CreateIndex
CREATE INDEX "admin_session_expires_at_idx" ON "admin_session"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_email_key" ON "staff_user"("email");

-- AddForeignKey
ALTER TABLE "admin_session" ADD CONSTRAINT "admin_session_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- staff_user
-- An e-mail is stored in the form the API computes (trimmed, lower case), so that the unique key
-- is the identity of a person and two spellings cannot be two accounts.
ALTER TABLE "staff_user"
  ADD CONSTRAINT "ck_staff_user_email_form"
  CHECK (
    "email" IS NULL
    OR (
      "email" = lower(btrim("email"))
      AND char_length("email") BETWEEN 3 AND 254
      AND "email" LIKE '%_@_%'
    )
  );

-- admin_session
-- Only the SHA-256 of a token, as 64 lowercase hexadecimal characters, is ever stored.
ALTER TABLE "admin_session"
  ADD CONSTRAINT "ck_admin_session_token_hash_form"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "admin_session"
  ADD CONSTRAINT "ck_admin_session_expires_after_creation"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "admin_session"
  ADD CONSTRAINT "ck_admin_session_last_seen_not_before_creation"
  CHECK ("last_seen_at" >= "created_at");

ALTER TABLE "admin_session"
  ADD CONSTRAINT "ck_admin_session_revoked_not_before_creation"
  CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at");
