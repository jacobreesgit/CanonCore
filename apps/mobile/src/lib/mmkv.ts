import { MMKV } from "react-native-mmkv";
import type { Storage } from "redux-persist";

/**
 * MMKV instance for Redux persist — ~30x faster than AsyncStorage.
 * Falls back to in-memory map when TurboModules aren't available (Expo Go).
 */
let mmkv: MMKV | null = null;
try {
  mmkv = new MMKV({ id: "canoncore.redux" });
} catch {
  // Expo Go doesn't support TurboModules — MMKV 3.x won't initialise.
  // Dev builds and production builds use New Architecture and work fine.
}

const fallbackMap = new Map<string, string>();

/**
 * redux-persist storage adapter wrapping MMKV's synchronous API.
 * Uses an in-memory Map as fallback when MMKV is unavailable.
 */
export const reduxStorage: Storage = {
  setItem: (key: string, value: string) => {
    if (mmkv) mmkv.set(key, value);
    else fallbackMap.set(key, value);
    return Promise.resolve(true);
  },
  getItem: (key: string) => {
    const value = mmkv ? mmkv.getString(key) : fallbackMap.get(key);
    return Promise.resolve(value ?? null);
  },
  removeItem: (key: string) => {
    if (mmkv) mmkv.delete(key);
    else fallbackMap.delete(key);
    return Promise.resolve();
  },
};
