import { appEdition } from "./appEdition";

const storageKey = `chatexportmate.onboarded.${appEdition}`;

export function hasCompletedOnboarding(): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    // If local storage is unavailable, never trap the user in onboarding.
    return true;
  }
}

export function markOnboardingComplete(): void {
  try {
    window.localStorage.setItem(storageKey, "true");
  } catch {
    // Onboarding will show again on the next launch.
  }
}
