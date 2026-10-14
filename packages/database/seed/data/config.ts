// Everything here is obviously fake demo data. No real business, person, brand or phone number.

// Centre of the fictional area: places and resellers are placed around it. Change it to see the
// demo data around another town.
export const DEMO_CENTRE = { lat: -18.8792, lng: 47.5079 } as const;

// Flat delivery fee outside every axis, in ariary: the default of shop_setting, frozen on the
// demo orders that were delivered outside an axis.
export const DEMO_OUT_OF_AXIS_FEE_AR = 4000;

// +44 7700 900xxx is the range that Ofcom reserves for drama: it never rings a real person.
export function demoPhone(index: number): string {
  return `+447700900${String(index).padStart(3, "0")}`;
}
