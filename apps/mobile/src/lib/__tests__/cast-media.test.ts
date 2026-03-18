import { buildCastMediaRequest, buildCastQueue } from "@/lib/cast-media";
import type { QueueTrack } from "@canoncore/store/types";

// Mock getStreamUrl since it builds URLs with env vars
jest.mock("@/lib/image-url", () => ({
  getStreamUrl: (fileId: string) => `https://example.com/api/stream/${fileId}`,
}));

const mockVideoTrack: QueueTrack = {
  fileId: "file-1",
  itemId: "item-1",
  filename: "test-movie.mp4",
  mimeType: "video/mp4",
  itemName: "Test Movie",
  posterUrl: "https://example.com/poster.jpg",
  duration: 7200,
  playbackPosition: 0,
};

const mockAudioTrack: QueueTrack = {
  ...mockVideoTrack,
  fileId: "file-2",
  filename: "test-song.mp3",
  mimeType: "audio/mpeg",
  itemName: "Test Song",
};

describe("buildCastMediaRequest", () => {
  it("builds a valid media request from a QueueTrack", () => {
    const request = buildCastMediaRequest(mockVideoTrack, 0);

    expect(request.autoplay).toBe(true);
    expect(request.startTime).toBe(0);
    expect(request.mediaInfo?.contentType).toBe("video/mp4");
    expect(request.mediaInfo?.contentUrl).toBe(
      "https://example.com/api/stream/file-1",
    );
  });

  it("sets startTime from second argument", () => {
    const request = buildCastMediaRequest(mockVideoTrack, 120);
    expect(request.startTime).toBe(120);
  });

  it("defaults startTime to 0", () => {
    const request = buildCastMediaRequest(mockVideoTrack);
    expect(request.startTime).toBe(0);
  });

  it("handles audio tracks", () => {
    const request = buildCastMediaRequest(mockAudioTrack);
    expect(request.mediaInfo?.contentType).toBe("audio/mpeg");
  });

  it("includes poster image in metadata", () => {
    const request = buildCastMediaRequest(mockVideoTrack);
    expect(request.mediaInfo?.metadata?.images).toEqual([
      { url: "https://example.com/poster.jpg" },
    ]);
  });

  it("handles tracks without poster", () => {
    const noPoster = { ...mockVideoTrack, posterUrl: undefined };
    const request = buildCastMediaRequest(noPoster);
    expect(request.mediaInfo?.metadata?.images).toEqual([]);
  });
});

describe("buildCastQueue", () => {
  const tracks = [mockVideoTrack, mockAudioTrack];

  it("builds a queue with correct startIndex", () => {
    const request = buildCastQueue(tracks, 0);
    expect(request.queueData?.startIndex).toBe(0);
    expect(request.queueData?.items).toHaveLength(2);
  });

  it("throws for invalid start index", () => {
    expect(() => buildCastQueue(tracks, 5)).toThrow(
      "Invalid start index for cast queue",
    );
  });

  it("sets autoplay on all queue items", () => {
    const request = buildCastQueue(tracks, 0);
    const items = request.queueData?.items ?? [];
    for (const item of items) {
      expect(item.autoplay).toBe(true);
    }
  });
});
