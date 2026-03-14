const storage = new Map<string, string>();

export class MMKV {
  set(key: string, value: string | number | boolean): void {
    storage.set(key, String(value));
  }

  getString(key: string): string | undefined {
    return storage.get(key);
  }

  getNumber(key: string): number | undefined {
    const val = storage.get(key);
    return val !== undefined ? Number(val) : undefined;
  }

  getBoolean(key: string): boolean | undefined {
    const val = storage.get(key);
    return val !== undefined ? val === "true" : undefined;
  }

  delete(key: string): void {
    storage.delete(key);
  }

  clearAll(): void {
    storage.clear();
  }

  getAllKeys(): string[] {
    return [...storage.keys()];
  }
}
