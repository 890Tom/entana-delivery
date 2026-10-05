/** The source of the current time. Injected, so that time-dependent code can be tested. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol("CLOCK");

export const systemClock: Clock = { now: () => new Date() };
