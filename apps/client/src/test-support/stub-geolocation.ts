import { vi } from "vitest";
import type { Mock } from "vitest";

type Success = (position: { coords: { latitude: number; longitude: number } }) => void;
type Failure = (error: { code: number }) => void;

type GetCurrentPosition = (success: Success, failure: Failure, options?: PositionOptions) => void;

export interface GeolocationStub {
  readonly getCurrentPosition: Mock<GetCurrentPosition>;
  readonly succeed: (latitude: number, longitude: number) => void;
  readonly fail: (code: 1 | 2 | 3) => void;
}

/** jsdom has no geolocation: this is the device boundary, answered by the test. */
export function stubGeolocation(): GeolocationStub {
  const callbacks: { success: Success; failure: Failure }[] = [];
  const getCurrentPosition = vi.fn<GetCurrentPosition>((success, failure) => {
    callbacks.push({ success, failure });
  });
  Object.defineProperty(navigator, "geolocation", {
    value: { getCurrentPosition },
    configurable: true,
  });
  return {
    getCurrentPosition,
    succeed: (latitude, longitude) => {
      callbacks.shift()?.success({ coords: { latitude, longitude } });
    },
    fail: (code) => {
      callbacks.shift()?.failure({ code });
    },
  };
}

export function restoreGeolocation(): void {
  Reflect.deleteProperty(navigator, "geolocation");
}
