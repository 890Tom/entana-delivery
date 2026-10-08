import { isIPv4, isIPv6 } from "node:net";

const UNKNOWN_ADDRESS = "unknown";
const IPV6_GROUPS = 8;
const IPV6_PREFIX_GROUPS = 4;
const MAPPED_PREFIX = [0, 0, 0, 0, 0, 0xffff];

// "1.2.3.4" as the two last groups of an IPv6 address.
function ipv4ToGroups(address: string): number[] {
  const [a = 0, b = 0, c = 0, d = 0] = address.split(".").map(Number);
  return [a * 256 + b, c * 256 + d];
}

function expandIpv6(address: string): number[] {
  const withoutZone = address.split("%")[0] ?? address;
  const lastColon = withoutZone.lastIndexOf(":");
  const tail = withoutZone.slice(lastColon + 1);
  const text = isIPv4(tail)
    ? `${withoutZone.slice(0, lastColon + 1)}${ipv4ToGroups(tail)
        .map((group) => group.toString(16))
        .join(":")}`
    : withoutZone;
  const [head = "", rest] = text.split("::");
  const front = head === "" ? [] : head.split(":");
  const back = rest === undefined || rest === "" ? [] : rest.split(":");
  const missing = rest === undefined ? 0 : IPV6_GROUPS - front.length - back.length;
  return [...front, ...Array<string>(missing).fill("0"), ...back].map((group) =>
    Number.parseInt(group, 16),
  );
}

function isIpv4Mapped(groups: readonly number[]): boolean {
  return MAPPED_PREFIX.every((value, index) => groups[index] === value);
}

/**
 * The key under which an address is counted. An IPv4-mapped IPv6 address (::ffff:a.b.c.d) is the
 * same machine as the plain IPv4 address, so it gets the same key. An IPv6 address is cut to its
 * /64 prefix: one subscriber normally owns a whole /64 and can pick any host part in it, so a key
 * per full address would give it 2^64 free counters. Anything unreadable shares one key.
 */
export function normalizeAddress(address: string | undefined): string {
  if (address === undefined) {
    return UNKNOWN_ADDRESS;
  }
  if (isIPv4(address)) {
    return address;
  }
  if (!isIPv6(address)) {
    return UNKNOWN_ADDRESS;
  }
  const groups = expandIpv6(address);
  if (isIpv4Mapped(groups)) {
    const [high = 0, low = 0] = groups.slice(6);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
  }
  return `${groups
    .slice(0, IPV6_PREFIX_GROUPS)
    .map((group) => group.toString(16))
    .join(":")}::/64`;
}
