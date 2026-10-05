-- CHECK constraints, written by hand: Prisma cannot represent them in the schema (ADR 0007).
-- Rules come from docs/data-model.md. Names follow ck_<table>_<meaning>.

-- customer
ALTER TABLE "customer"
  ADD CONSTRAINT "ck_customer_phone_e164_format"
  CHECK ("phone_e164" ~ '^\+[1-9][0-9]{6,14}$');

-- customer_order
ALTER TABLE "customer_order"
  ADD CONSTRAINT "ck_customer_order_delivery_date_when_confirmed"
  CHECK ("status" IN ('NEW', 'REJECTED', 'CANCELLED') OR "delivery_date" IS NOT NULL);

ALTER TABLE "customer_order"
  ADD CONSTRAINT "ck_customer_order_reason_when_closed_unhappily"
  CHECK ("status" NOT IN ('REJECTED', 'CANCELLED', 'FAILED') OR "status_reason" IS NOT NULL);

ALTER TABLE "customer_order"
  ADD CONSTRAINT "ck_customer_order_amounts_not_negative"
  CHECK ("delivery_fee" >= 0 AND "total_ar" >= 0);

ALTER TABLE "customer_order"
  ADD CONSTRAINT "ck_customer_order_public_code_length"
  CHECK (char_length("public_code") = 6);

-- order_item
ALTER TABLE "order_item"
  ADD CONSTRAINT "ck_order_item_qty_and_price"
  CHECK ("qty" > 0 AND "unit_price" >= 0);

-- order_event
ALTER TABLE "order_event"
  ADD CONSTRAINT "ck_order_event_to_status_when_status_changed"
  CHECK ("type" <> 'STATUS_CHANGED' OR "to_status" IS NOT NULL);

-- product
ALTER TABLE "product"
  ADD CONSTRAINT "ck_product_price_positive"
  CHECK ("price_ar" > 0);

ALTER TABLE "product"
  ADD CONSTRAINT "ck_product_photo_when_active"
  CHECK ("active" = false OR ("image_key" IS NOT NULL AND "image_alt" IS NOT NULL));

-- place
ALTER TABLE "place"
  ADD CONSTRAINT "ck_place_radius_range"
  CHECK ("radius_m" BETWEEN 100 AND 3000);

-- reseller
ALTER TABLE "reseller"
  ADD CONSTRAINT "ck_reseller_consent_when_active"
  CHECK ("active" = false OR "consent_at" IS NOT NULL);

-- shop_setting
ALTER TABLE "shop_setting"
  ADD CONSTRAINT "ck_shop_setting_single_row_and_fee"
  CHECK ("id" = 1 AND "out_of_axis_fee_ar" >= 0);

-- staff_user
ALTER TABLE "staff_user"
  ADD CONSTRAINT "ck_staff_user_failed_login_count_not_negative"
  CHECK ("failed_login_count" >= 0);
