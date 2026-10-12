import { adminConstraintCases } from "./admin-check-constraint-cases.js";
import type { ConstraintCase } from "./constraint-case.js";
import {
  insertCustomer,
  insertOrder,
  insertOrderEvent,
  insertOrderItem,
  insertPlace,
  insertProduct,
  insertReseller,
  insertShopSetting,
  insertStaffUser,
} from "../support/database-access/rows.js";

const A_DAY = "2026-10-10";

export const constraintCases: ConstraintCase[] = [
  {
    constraint: "ck_customer_phone_e164_format",
    accepted: [
      {
        name: "a Malagasy number in E.164 format",
        run: (db) => insertCustomer(db, { phone_e164: "+261340000000" }),
      },
      {
        name: "the shortest allowed number (7 digits)",
        run: (db) => insertCustomer(db, { phone_e164: "+1234567" }),
      },
    ],
    rejected: [
      {
        name: "a number without the leading +",
        run: (db) => insertCustomer(db, { phone_e164: "261340000000" }),
      },
      {
        name: "a number starting with 0 after the +",
        run: (db) => insertCustomer(db, { phone_e164: "+0340000000" }),
      },
      {
        name: "a number that is too short (6 digits)",
        run: (db) => insertCustomer(db, { phone_e164: "+123456" }),
      },
      {
        name: "a number that is too long (16 digits)",
        run: (db) => insertCustomer(db, { phone_e164: "+1234567890123456" }),
      },
    ],
  },
  {
    constraint: "ck_customer_order_delivery_date_when_confirmed",
    accepted: [
      { name: "a new order without a delivery date", run: (db) => insertOrder(db) },
      {
        name: "a confirmed order with a delivery date",
        run: (db) => insertOrder(db, { status: "CONFIRMED", delivery_date: A_DAY }),
      },
      {
        name: "an order cancelled before it was confirmed, without a delivery date",
        run: (db) => insertOrder(db, { status: "CANCELLED", status_reason: "Customer asked" }),
      },
      {
        name: "a rejected order without a delivery date",
        run: (db) => insertOrder(db, { status: "REJECTED", status_reason: "Out of stock" }),
      },
    ],
    rejected: [
      {
        name: "a confirmed order without a delivery date",
        run: (db) => insertOrder(db, { status: "CONFIRMED" }),
      },
      {
        name: "an order out for delivery without a delivery date",
        run: (db) => insertOrder(db, { status: "OUT_FOR_DELIVERY" }),
      },
      {
        name: "a delivered order without a delivery date",
        run: (db) => insertOrder(db, { status: "DELIVERED" }),
      },
      {
        name: "a failed order without a delivery date",
        run: (db) => insertOrder(db, { status: "FAILED", status_reason: "Nobody at home" }),
      },
    ],
  },
  {
    constraint: "ck_customer_order_reason_when_closed_unhappily",
    accepted: [
      {
        name: "a cancelled order with a reason",
        run: (db) =>
          insertOrder(db, {
            status: "CANCELLED",
            delivery_date: A_DAY,
            status_reason: "Customer asked",
          }),
      },
      {
        name: "a delivered order without a reason",
        run: (db) => insertOrder(db, { status: "DELIVERED", delivery_date: A_DAY }),
      },
    ],
    rejected: [
      {
        name: "a rejected order without a reason",
        run: (db) => insertOrder(db, { status: "REJECTED" }),
      },
      {
        name: "a cancelled order without a reason",
        run: (db) => insertOrder(db, { status: "CANCELLED", delivery_date: A_DAY }),
      },
      {
        name: "an order cancelled before confirmation, without a delivery date and without a reason",
        run: (db) => insertOrder(db, { status: "CANCELLED" }),
      },
      {
        name: "a failed order without a reason",
        run: (db) => insertOrder(db, { status: "FAILED", delivery_date: A_DAY }),
      },
    ],
  },
  {
    constraint: "ck_customer_order_amounts_not_negative",
    accepted: [
      {
        name: "a free delivery and an empty total",
        run: (db) => insertOrder(db, { delivery_fee: 0, total_ar: 0 }),
      },
    ],
    rejected: [
      {
        name: "a negative delivery fee",
        run: (db) => insertOrder(db, { delivery_fee: -1 }),
      },
      { name: "a negative total", run: (db) => insertOrder(db, { total_ar: -1 }) },
    ],
  },
  {
    constraint: "ck_customer_order_public_code_length",
    accepted: [
      { name: "a code of 6 characters", run: (db) => insertOrder(db, { public_code: "ABC234" }) },
    ],
    rejected: [
      { name: "a code of 5 characters", run: (db) => insertOrder(db, { public_code: "ABC23" }) },
      { name: "a code of 7 characters", run: (db) => insertOrder(db, { public_code: "ABC2345" }) },
    ],
  },
  {
    constraint: "ck_order_item_qty_and_price",
    accepted: [
      {
        name: "a quantity of 1 and a free item",
        run: (db) => insertOrderItem(db, { qty: 1, unit_price: 0 }),
      },
    ],
    rejected: [
      { name: "a quantity of 0", run: (db) => insertOrderItem(db, { qty: 0 }) },
      { name: "a negative quantity", run: (db) => insertOrderItem(db, { qty: -1 }) },
      { name: "a negative unit price", run: (db) => insertOrderItem(db, { unit_price: -1 }) },
    ],
  },
  {
    constraint: "ck_order_event_to_status_when_status_changed",
    accepted: [
      {
        name: "a status change that names the new status",
        run: (db) => insertOrderEvent(db, { type: "STATUS_CHANGED", to_status: "CONFIRMED" }),
      },
      {
        name: "a lines edit without a status",
        run: (db) =>
          insertOrderEvent(db, { type: "LINES_EDITED", from_status: null, to_status: null }),
      },
    ],
    rejected: [
      {
        name: "a status change without the new status",
        run: (db) => insertOrderEvent(db, { type: "STATUS_CHANGED", to_status: null }),
      },
    ],
  },
  {
    constraint: "ck_product_price_positive",
    accepted: [{ name: "a price of 1 ariary", run: (db) => insertProduct(db, { price_ar: 1 }) }],
    rejected: [
      { name: "a free product", run: (db) => insertProduct(db, { price_ar: 0 }) },
      { name: "a negative price", run: (db) => insertProduct(db, { price_ar: -5 }) },
    ],
  },
  {
    constraint: "ck_product_photo_when_active",
    accepted: [
      {
        name: "an active product with a photo and its alternative text",
        run: (db) =>
          insertProduct(db, { active: true, image_key: "products/a.jpg", image_alt: "A product" }),
      },
      {
        name: "an inactive product without a photo",
        run: (db) => insertProduct(db, { active: false }),
      },
    ],
    rejected: [
      {
        name: "an active product without a photo",
        run: (db) => insertProduct(db, { active: true, image_alt: "A product" }),
      },
      {
        name: "an active product without alternative text",
        run: (db) => insertProduct(db, { active: true, image_key: "products/a.jpg" }),
      },
    ],
  },
  {
    constraint: "ck_place_radius_range",
    accepted: [
      { name: "the smallest radius (100 m)", run: (db) => insertPlace(db, { radius_m: 100 }) },
      { name: "the largest radius (3000 m)", run: (db) => insertPlace(db, { radius_m: 3000 }) },
    ],
    rejected: [
      { name: "a radius below 100 m", run: (db) => insertPlace(db, { radius_m: 99 }) },
      { name: "a radius above 3000 m", run: (db) => insertPlace(db, { radius_m: 3001 }) },
    ],
  },
  {
    constraint: "ck_reseller_consent_when_active",
    accepted: [
      {
        name: "an active reseller who gave consent",
        run: (db) => insertReseller(db, { active: true, consent_at: new Date() }),
      },
      {
        name: "an inactive reseller without consent",
        run: (db) => insertReseller(db, { active: false }),
      },
    ],
    rejected: [
      {
        name: "an active reseller without consent",
        run: (db) => insertReseller(db, { active: true }),
      },
    ],
  },
  {
    constraint: "ck_shop_setting_single_row_and_fee",
    accepted: [
      {
        name: "the single settings row with a free out-of-axis fee",
        run: (db) => insertShopSetting(db, { id: 1, out_of_axis_fee_ar: 0 }),
      },
    ],
    rejected: [
      {
        name: "a second settings row",
        run: (db) => insertShopSetting(db, { id: 2 }),
      },
      {
        name: "a negative out-of-axis fee",
        run: (db) => insertShopSetting(db, { out_of_axis_fee_ar: -1 }),
      },
    ],
  },
  {
    constraint: "ck_staff_user_failed_login_count_not_negative",
    accepted: [
      {
        name: "a counter at zero",
        run: (db) => insertStaffUser(db, { failed_login_count: 0 }),
      },
    ],
    rejected: [
      {
        name: "a negative counter",
        run: (db) => insertStaffUser(db, { failed_login_count: -1 }),
      },
    ],
  },
  ...adminConstraintCases,
];
