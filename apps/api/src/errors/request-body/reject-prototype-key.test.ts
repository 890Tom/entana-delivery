import { describe, expect, it } from "vitest";
import { MAX_BODY_DEPTH, MAX_BODY_NODES, inspectJsonValue } from "./reject-prototype-key.js";

// Made by JSON.parse, like the body of a request: an object literal would set the prototype.
function parse(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function nested(depth: number): unknown {
  return parse(`${"[".repeat(depth)}${"]".repeat(depth)}`);
}

describe("inspectJsonValue", () => {
  it.each([
    ["null", "null"],
    ["a string", '"x"'],
    ["a string that contains __proto__", '{"contactName":"__proto__"}'],
    ["a value named like a prototype key", '{"a":"__proto__","b":["__proto__"]}'],
    ["a key that only contains the text", '{"a__proto__":1,"__proto__a":2}'],
    ["an ordinary body", '{"items":[{"productId":"x","quantity":1}],"location":{"lat":1,"lng":2}}'],
  ])("accepts %s", (_name, text) => {
    expect(inspectJsonValue(parse(text))).toBe("ok");
  });

  it.each([
    ["the root", '{"__proto__":{"polluted":true}}'],
    ["a nested object", '{"location":{"lat":1,"__proto__":{}}}'],
    ["an object in an array", '{"items":[{"quantity":1},{"__proto__":1}]}'],
    ["a deep object", '{"a":{"b":{"c":{"d":{"__proto__":null}}}}}'],
    ["an array at the root", '[{"__proto__":1}]'],
  ])("refuses an own __proto__ key in %s", (_name, text) => {
    expect(inspectJsonValue(parse(text))).toBe("prototype-key");
  });

  it.each([
    ["an escaped key", '{"\\u005f_proto__":{}}'],
    ["a duplicate key", '{"a":1,"__proto__":{},"__proto__":1}'],
  ])("refuses %s", (_name, text) => {
    expect(inspectJsonValue(parse(text))).toBe("prototype-key");
  });

  it.each(["constructor", "prototype"])("refuses an own %s key at any depth", (key) => {
    expect(inspectJsonValue(parse(`{"a":[{"${key}":1}]}`))).toBe("prototype-key");
  });

  it("does not follow a prototype chain: only own properties count", () => {
    expect(inspectJsonValue(Object.create({ constructor: 1 }))).toBe("ok");
  });

  it("accepts the maximum depth and refuses one level more", () => {
    expect(inspectJsonValue(nested(MAX_BODY_DEPTH))).toBe("ok");
    expect(inspectJsonValue(nested(MAX_BODY_DEPTH + 1))).toBe("too-deep");
  });

  it("refuses a body 100 000 levels deep without exhausting the stack", () => {
    expect(inspectJsonValue(nested(100_000))).toBe("too-deep");
  });

  it("accepts the maximum number of nodes and refuses one more", () => {
    const withNodes = (count: number): unknown => Array.from({ length: count - 1 }, () => 0);
    expect(inspectJsonValue(withNodes(MAX_BODY_NODES))).toBe("ok");
    expect(inspectJsonValue(withNodes(MAX_BODY_NODES + 1))).toBe("too-large");
  });

  it("refuses 1 000 000 nodes", () => {
    expect(inspectJsonValue(Array.from({ length: 1_000_000 }, () => 0))).toBe("too-large");
  });

  it("sees a prototype key among the last values of the budget", () => {
    const body = parse(`[${"0,".repeat(MAX_BODY_NODES - 3)}{"constructor":1}]`);
    expect(inspectJsonValue(body)).toBe("prototype-key");
  });

  it("refuses a prototype key at the maximum depth", () => {
    const body = parse(
      `${'{"a":'.repeat(MAX_BODY_DEPTH - 1)}{"prototype":1}${"}".repeat(MAX_BODY_DEPTH - 1)}`,
    );
    expect(inspectJsonValue(body)).toBe("prototype-key");
  });

  it.each(["toString", "hasOwnProperty", "valueOf"])("accepts an own %s key", (key) => {
    expect(inspectJsonValue(parse(`{"${key}":1}`))).toBe("ok");
  });
});
