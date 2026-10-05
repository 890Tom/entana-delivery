-- CreateEnum
CREATE TYPE "trust_level" AS ENUM ('NEW', 'KNOWN', 'BLOCKED');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('NEW', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "fee_reason" AS ENUM ('IN_AXIS', 'OUT_OF_AXIS', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "order_event_type" AS ENUM ('STATUS_CHANGED', 'LINES_EDITED', 'FEE_ADJUSTED', 'DATE_CHANGED');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('STAFF', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('ADMIN', 'DRIVER');

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "phone_e164" TEXT NOT NULL,
    "trust_level" "trust_level" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "public_token_hash" TEXT NOT NULL,
    "public_code" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "place_id" UUID,
    "axis_id" UUID,
    "delivery_fee" INTEGER NOT NULL,
    "fee_reason" "fee_reason" NOT NULL,
    "delivery_date" DATE,
    "status" "order_status" NOT NULL,
    "status_reason" TEXT,
    "contact_name" TEXT NOT NULL,
    "customer_note" TEXT,
    "driver_id" UUID,
    "tour_position" INTEGER,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "landmark_text" TEXT NOT NULL,
    "total_ar" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "type" "order_event_type" NOT NULL,
    "from_status" "order_status",
    "to_status" "order_status",
    "actor_type" "actor_type" NOT NULL,
    "actor_id" UUID,
    "payload" JSONB NOT NULL,
    "client_event_id" UUID,
    "client_ts" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_ar" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "available" BOOLEAN NOT NULL,
    "availability_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "position" INTEGER NOT NULL,
    "image_key" TEXT,
    "image_alt" TEXT,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "place" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius_m" INTEGER NOT NULL DEFAULT 500,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_axis" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "delivery_axis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "axis_place" (
    "axis_id" UUID NOT NULL,
    "place_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "axis_place_pkey" PRIMARY KEY ("axis_id","place_id")
);

-- CreateTable
CREATE TABLE "staff_user" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT,
    "role" "staff_role" NOT NULL,
    "password_hash" TEXT NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "active" BOOLEAN NOT NULL,

    CONSTRAINT "staff_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "diff" JSONB NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "landmark_text" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL,
    "consent_at" TIMESTAMPTZ(3),
    "verified_at" TIMESTAMPTZ(3),

    CONSTRAINT "reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_setting" (
    "id" INTEGER NOT NULL,
    "out_of_axis_fee_ar" INTEGER NOT NULL,
    "out_of_axis_message" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shop_setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_phone_e164_key" ON "customer"("phone_e164");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_public_token_hash_key" ON "customer_order"("public_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_public_code_key" ON "customer_order"("public_code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_order_idempotency_key_key" ON "customer_order"("idempotency_key");

-- CreateIndex
CREATE INDEX "customer_order_customer_id_idx" ON "customer_order"("customer_id");

-- CreateIndex
CREATE INDEX "customer_order_status_delivery_date_axis_id_idx" ON "customer_order"("status", "delivery_date", "axis_id");

-- CreateIndex
CREATE INDEX "order_item_order_id_idx" ON "order_item"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_event_client_event_id_key" ON "order_event"("client_event_id");

-- CreateIndex
CREATE INDEX "order_event_order_id_created_at_idx" ON "order_event"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_axis_name_key" ON "delivery_axis"("name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_username_key" ON "staff_user"("username");

-- AddForeignKey
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_axis_id_fkey" FOREIGN KEY ("axis_id") REFERENCES "delivery_axis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order" ADD CONSTRAINT "customer_order_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "customer_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "customer_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axis_place" ADD CONSTRAINT "axis_place_axis_id_fkey" FOREIGN KEY ("axis_id") REFERENCES "delivery_axis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axis_place" ADD CONSTRAINT "axis_place_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "staff_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
