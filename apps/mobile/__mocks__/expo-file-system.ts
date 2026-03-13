// Mock for expo-file-system v19 API (File, Directory, Paths classes)

export const Paths = {
  document: "/mock/documents",
  cache: "/mock/cache",
  appleSharedContainers: {},
};

export class File {
  readonly uri: string;

  constructor(...paths: string[]) {
    this.uri = paths.join("/");
  }

  get exists(): boolean {
    return false;
  }

  create(): void {}

  write(_content: string): void {}

  text(): string {
    return "";
  }

  delete(): void {}

  static downloadFileAsync(
    _url: string,
    _destination: File,
    _options?: Record<string, unknown>
  ): Promise<void> {
    return Promise.resolve();
  }
}

export class Directory {
  readonly uri: string;

  constructor(...paths: string[]) {
    this.uri = paths.join("/");
  }

  get exists(): boolean {
    return false;
  }

  create(_options?: { intermediates?: boolean }): void {}

  delete(): void {}
}
