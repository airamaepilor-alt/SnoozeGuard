/**
 * Module-level mutable flag shared between DriveScreen and App.tsx.
 * True while a driving session is active — used to intercept tab navigation.
 * Safe as a plain ref because there is exactly one DriveScreen instance.
 */
export const drivingSessionActive = { current: false };

/**
 * Set by DriveScreen so App.tsx can call endSession from the nav guard alert.
 */
export const endSessionFn: { current: (() => void) | null } = { current: null };
