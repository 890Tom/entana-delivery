import type { FrozenOrderAmounts, OrderSearch, OrderStatus } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import type { StoredAdminOrder, StoredOrderListItem } from "../rules/to-admin-order.js";

/** What the queries need from the client: the PrismaClient and its transaction client both fit. */
export type AdminOrderDatabase = Pick<PrismaClient, "customerOrder" | "orderEvent">;

// An explicit allow-list: the token hash, the customer's id and the driver never leave the database.
const SUMMARY_SELECT = {
  id: true,
  publicCode: true,
  status: true,
  createdAt: true,
  deliveryDate: true,
  contactName: true,
  landmarkText: true,
  totalAr: true,
  customer: { select: { phoneE164: true } },
  items: { select: { qty: true } },
  // Joined when read: a place or an axis renamed later shows its current name.
  place: { select: { name: true } },
  axis: { select: { name: true } },
} as const;

const LIST_SELECT = { ...SUMMARY_SELECT, customerId: true } as const;

type OrderWhere = NonNullable<Parameters<AdminOrderDatabase["customerOrder"]["count"]>[0]>["where"];

/** The filters of the list, all optional. The cursor is not one: a count ignores it. */
export interface OrderFilter {
  readonly statuses?: readonly OrderStatus[];
  /** The instants a day of the instance time zone starts and ends (excluded), and that day. */
  readonly day?: { readonly start: Date; readonly end: Date; readonly date: string };
  readonly search?: OrderSearch;
  /** The id of an axis, or `none` for the orders outside every axis. */
  readonly zone?: string;
}

function buildWhere(filter: OrderFilter): OrderWhere {
  const { statuses, day, search, zone } = filter;
  return {
    ...(statuses === undefined ? {} : { status: { in: [...statuses] } }),
    ...(day === undefined
      ? {}
      : {
          OR: [
            { createdAt: { gte: day.start, lt: day.end } },
            { deliveryDate: new Date(day.date) },
          ],
        }),
    ...(search?.kind === "name"
      ? { contactName: { contains: search.text, mode: "insensitive" as const } }
      : {}),
    ...(search?.kind === "phone" ? { customer: { phoneE164: { contains: search.digits } } } : {}),
    ...(zone === undefined ? {} : { axisId: zone === "none" ? null : zone }),
  };
}

/**
 * One page, newest first: `limit + 1` rows are read so that the caller knows whether another page
 * follows. The id is a uuidv7, so ordering by it is ordering by creation, and "older than the
 * cursor" is a range on the primary key (no OFFSET).
 */
export function findOrderPage(
  database: AdminOrderDatabase,
  filter: OrderFilter & { before?: string; limit: number },
): Promise<StoredOrderListItem[]> {
  return database.customerOrder.findMany({
    where: {
      ...buildWhere(filter),
      ...(filter.before === undefined ? {} : { id: { lt: filter.before } }),
    },
    orderBy: { id: "desc" },
    take: filter.limit + 1,
    select: LIST_SELECT,
  });
}

export function countOrders(database: AdminOrderDatabase, filter: OrderFilter): Promise<number> {
  return database.customerOrder.count({ where: buildWhere(filter) });
}

/**
 * The oldest order of each of these customers, among all their orders (refused ones included,
 * whatever the filters and the page): an order is a first order when its id is that one.
 */
export async function findFirstOrderIds(
  database: AdminOrderDatabase,
  customerIds: readonly string[],
): Promise<ReadonlySet<string>> {
  // PostgreSQL has no min() on a uuid: the oldest id comes from an ordering and a DISTINCT ON.
  const firsts = await database.customerOrder.findMany({
    where: { customerId: { in: [...customerIds] } },
    distinct: ["customerId"],
    orderBy: [{ customerId: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return new Set(firsts.map((first) => first.id));
}

export function countOrdersToProcess(database: AdminOrderDatabase): Promise<number> {
  return database.customerOrder.count({ where: { status: "NEW" } });
}

export function countOrdersReceivedBetween(
  database: AdminOrderDatabase,
  start: Date,
  end: Date,
): Promise<number> {
  return database.customerOrder.count({ where: { createdAt: { gte: start, lt: end } } });
}

/** The orders NEW that came after an order (ids are uuidv7: later is greater), newest first. */
export async function findNewOrdersSince(
  database: AdminOrderDatabase,
  since: string,
): Promise<{
  readonly count: number;
  readonly latest: { id: string; publicCode: string; contactName: string } | null;
}> {
  const where = { status: "NEW" as const, id: { gt: since } };
  const [count, latest] = await Promise.all([
    database.customerOrder.count({ where }),
    database.customerOrder.findFirst({
      where,
      orderBy: { id: "desc" },
      select: { id: true, publicCode: true, contactName: true },
    }),
  ]);
  return { count, latest };
}

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  deliveryFee: true,
  customerNote: true,
  lat: true,
  lng: true,
  statusReason: true,
  items: {
    select: { productName: true, unitPrice: true, qty: true },
    orderBy: { id: "asc" },
  },
  events: {
    select: {
      type: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      actorType: true,
      actorId: true,
    },
    // uuidv7: by id is by creation, and it breaks the tie of two events in the same millisecond.
    orderBy: { id: "asc" },
  },
} as const;

export function findOrderDetail(
  database: AdminOrderDatabase,
  id: string,
): Promise<StoredAdminOrder | null> {
  return database.customerOrder.findUnique({ where: { id }, select: DETAIL_SELECT });
}

/** For an order that was just written in the same transaction: it exists, or the fault is ours. */
export function requireOrderDetail(
  database: AdminOrderDatabase,
  id: string,
): Promise<StoredAdminOrder> {
  return database.customerOrder.findUniqueOrThrow({ where: { id }, select: DETAIL_SELECT });
}

export async function findOrderStatus(
  database: AdminOrderDatabase,
  id: string,
): Promise<OrderStatus | null> {
  const order = await database.customerOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  return order?.status ?? null;
}

/** The fee and the total recorded on the order, and its frozen lines. */
export async function findOrderAmounts(
  database: AdminOrderDatabase,
  id: string,
): Promise<FrozenOrderAmounts> {
  const order = await database.customerOrder.findUniqueOrThrow({
    where: { id },
    select: { deliveryFee: true, items: { select: { unitPrice: true, qty: true } } },
  });
  return {
    deliveryFeeAr: order.deliveryFee,
    lines: order.items.map((item) => ({ unitPrice: item.unitPrice, quantity: item.qty })),
  };
}

export interface StatusChange {
  readonly from: OrderStatus;
  readonly to: OrderStatus;
  readonly statusReason?: string;
  readonly deliveryDate?: Date;
  /** An adjusted fee, written with the status: both change, or neither. */
  readonly fee?: { readonly deliveryFeeAr: number; readonly totalAr: number };
}

/**
 * Moves the order only if it still has the status that was read: a change made in between (the
 * customer's cancellation included) matches no row. Returns whether this call made the change.
 */
export async function changeStatusIfStatusIs(
  database: AdminOrderDatabase,
  id: string,
  change: StatusChange,
): Promise<boolean> {
  const { count } = await database.customerOrder.updateMany({
    where: { id, status: change.from },
    data: {
      status: change.to,
      ...(change.statusReason === undefined ? {} : { statusReason: change.statusReason }),
      ...(change.deliveryDate === undefined ? {} : { deliveryDate: change.deliveryDate }),
      ...(change.fee === undefined
        ? {}
        : {
            deliveryFee: change.fee.deliveryFeeAr,
            feeReason: "ADJUSTED" as const,
            totalAr: change.fee.totalAr,
          }),
    },
  });
  return count === 1;
}

export async function insertStatusChangedEvent(
  database: AdminOrderDatabase,
  event: {
    readonly orderId: string;
    readonly change: StatusChange;
    readonly adminId: string;
    readonly payload: Readonly<Record<string, string>>;
    readonly createdAt: Date;
  },
): Promise<void> {
  await database.orderEvent.create({
    data: {
      orderId: event.orderId,
      type: "STATUS_CHANGED",
      fromStatus: event.change.from,
      toStatus: event.change.to,
      actorType: "STAFF",
      actorId: event.adminId,
      payload: { ...event.payload },
      createdAt: event.createdAt,
    },
  });
}

/** The fee given at confirmation, by the same admin and at the same instant as the status. */
export async function insertFeeAdjustedEvent(
  database: AdminOrderDatabase,
  event: {
    readonly orderId: string;
    readonly adminId: string;
    readonly fromAr: number;
    readonly toAr: number;
    readonly createdAt: Date;
  },
): Promise<void> {
  await database.orderEvent.create({
    data: {
      orderId: event.orderId,
      type: "FEE_ADJUSTED",
      actorType: "STAFF",
      actorId: event.adminId,
      payload: { fromAr: event.fromAr, toAr: event.toAr },
      createdAt: event.createdAt,
    },
  });
}
