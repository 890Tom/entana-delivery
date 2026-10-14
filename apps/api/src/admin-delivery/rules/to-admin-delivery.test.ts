import { describe, expect, it } from "vitest";
import { toAdminDeliveryAxes, toAdminDeliveryPlaces } from "./to-admin-delivery.js";
import type { StoredAxis, StoredPlace } from "./to-admin-delivery.js";

const place = (id: string, name: string, isActive = true): StoredPlace => ({
  id,
  name,
  lat: -18.9,
  lng: 47.5,
  radiusM: 500,
  active: isActive,
});
const SHARED = place("p-shared", "Shared");
const axis = (id: string, rank: number, places: readonly StoredPlace[]): StoredAxis => ({
  id,
  name: `Axis ${id}`,
  rank,
  color: "#2f6b5a",
  active: true,
  places: places.map((stored, index) => ({ position: index + 1, place: stored })),
});

describe("toAdminDeliveryAxes", () => {
  it("lists in each axis the other axes that hold the place, by rank, never itself", () => {
    const axes = [
      axis("c", 3, [SHARED]),
      axis("a", 1, [place("p-a", "Only A"), SHARED]),
      axis("b", 2, [SHARED]),
    ];

    const [first] = toAdminDeliveryAxes(axes).axes;

    expect(first?.places.map((entry) => entry.alsoIn)).toEqual([
      [],
      [
        { id: "b", name: "Axis b" },
        { id: "c", name: "Axis c" },
      ],
    ]);
  });

  it("keeps the order of the positions and the inactive places with their flag", () => {
    const axes = [axis("a", 1, [place("p1", "First"), place("p2", "Second", false)])];

    const [only] = toAdminDeliveryAxes(axes).axes;

    expect(only?.places.map((entry) => [entry.name, entry.active])).toEqual([
      ["First", true],
      ["Second", false],
    ]);
    expect(only?.places[0]).toMatchObject({ latitude: -18.9, longitude: 47.5, radiusM: 500 });
  });
});

describe("toAdminDeliveryPlaces", () => {
  it("renames the columns of the contract", () => {
    expect(toAdminDeliveryPlaces([place("p1", "One")]).places).toEqual([
      { id: "p1", name: "One", latitude: -18.9, longitude: 47.5, radiusM: 500 },
    ]);
  });
});
