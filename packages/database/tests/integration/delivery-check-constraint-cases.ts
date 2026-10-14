import type { ConstraintCase } from "./constraint-case.js";
import {
  insertDeliveryAxis,
  insertPlace,
  insertShopSettingWithId,
  updateShopSetting,
} from "../support/database-access/rows.js";

// Places, delivery axes and the settings (ADR 0021).
export const deliveryConstraintCases: ConstraintCase[] = [
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
    constraint: "ck_place_name_length",
    accepted: [
      { name: "a name of one character", run: (db) => insertPlace(db, { name: "A" }) },
      { name: "a name of 60 characters", run: (db) => insertPlace(db, { name: "a".repeat(60) }) },
    ],
    rejected: [
      { name: "an empty name", run: (db) => insertPlace(db, { name: "" }) },
      { name: "a name of 61 characters", run: (db) => insertPlace(db, { name: "a".repeat(61) }) },
    ],
  },
  {
    constraint: "ck_place_latitude_range",
    accepted: [
      { name: "the south pole", run: (db) => insertPlace(db, { lat: -90 }) },
      { name: "the north pole", run: (db) => insertPlace(db, { lat: 90 }) },
    ],
    rejected: [
      { name: "a latitude below -90", run: (db) => insertPlace(db, { lat: -90.1 }) },
      { name: "a latitude above 90", run: (db) => insertPlace(db, { lat: 90.1 }) },
    ],
  },
  {
    constraint: "ck_place_longitude_range",
    accepted: [
      { name: "a longitude of -180", run: (db) => insertPlace(db, { lng: -180 }) },
      { name: "a longitude of 180", run: (db) => insertPlace(db, { lng: 180 }) },
    ],
    rejected: [
      { name: "a longitude below -180", run: (db) => insertPlace(db, { lng: -180.1 }) },
      { name: "a longitude above 180", run: (db) => insertPlace(db, { lng: 180.1 }) },
    ],
  },
  {
    constraint: "ck_delivery_axis_name_length",
    accepted: [
      { name: "a name of one character", run: (db) => insertDeliveryAxis(db, { name: "A" }) },
      {
        name: "a name of 60 characters",
        run: (db) => insertDeliveryAxis(db, { name: "a".repeat(60) }),
      },
    ],
    rejected: [
      { name: "an empty name", run: (db) => insertDeliveryAxis(db, { name: "" }) },
      {
        name: "a name of 61 characters",
        run: (db) => insertDeliveryAxis(db, { name: "a".repeat(61) }),
      },
    ],
  },
  {
    constraint: "ck_delivery_axis_rank_positive",
    accepted: [
      { name: "the highest priority (1)", run: (db) => insertDeliveryAxis(db, { rank: 1 }) },
    ],
    rejected: [{ name: "a rank of 0", run: (db) => insertDeliveryAxis(db, { rank: 0 }) }],
  },
  {
    constraint: "ck_delivery_axis_color_format",
    accepted: [
      { name: "a #rrggbb colour", run: (db) => insertDeliveryAxis(db, { color: "#2f6b5a" }) },
    ],
    rejected: [
      { name: "a colour in upper case", run: (db) => insertDeliveryAxis(db, { color: "#2F6B5A" }) },
      { name: "a short colour", run: (db) => insertDeliveryAxis(db, { color: "#abc" }) },
    ],
  },
  {
    constraint: "ck_shop_setting_single_row_and_fee",
    accepted: [
      {
        name: "the single settings row with a free out-of-axis fee",
        run: (db) => updateShopSetting(db, { out_of_axis_fee_ar: 0 }),
      },
    ],
    rejected: [
      { name: "a second settings row", run: (db) => insertShopSettingWithId(db, 2) },
      {
        name: "a negative out-of-axis fee",
        run: (db) => updateShopSetting(db, { out_of_axis_fee_ar: -1 }),
      },
    ],
  },
  {
    constraint: "ck_shop_setting_free_delivery_min_pieces",
    accepted: [
      {
        name: "a threshold of one piece",
        run: (db) => updateShopSetting(db, { free_delivery_min_pieces: 1 }),
      },
    ],
    rejected: [
      {
        name: "a threshold of zero",
        run: (db) => updateShopSetting(db, { free_delivery_min_pieces: 0 }),
      },
    ],
  },
  {
    constraint: "ck_shop_setting_message_length",
    accepted: [
      {
        name: "a message of 200 characters",
        run: (db) => updateShopSetting(db, { out_of_axis_message: "a".repeat(200) }),
      },
    ],
    rejected: [
      { name: "an empty message", run: (db) => updateShopSetting(db, { out_of_axis_message: "" }) },
      {
        name: "a message of only spaces",
        run: (db) => updateShopSetting(db, { out_of_axis_message: "   " }),
      },
      {
        name: "a message of 201 characters",
        run: (db) => updateShopSetting(db, { out_of_axis_message: "a".repeat(201) }),
      },
    ],
  },
];
