import { formatBytes } from "@/lib/format-bytes";

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats negative values as 0 B", () => {
    expect(formatBytes(-100)).toBe("0 B");
  });

  it("formats bytes (no decimal)", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes (no decimal)", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("formats megabytes (1 decimal)", () => {
    expect(formatBytes(1_048_576)).toBe("1.0 MB");
  });

  it("formats gigabytes (1 decimal)", () => {
    expect(formatBytes(1_073_741_824)).toBe("1.0 GB");
  });

  it("handles fractional megabytes", () => {
    // 1.5 MB = 1,572,864 bytes
    expect(formatBytes(1_572_864)).toBe("1.5 MB");
  });
});
