/**
 * MSW request handlers for Storybook stories.
 * Mocks TMDB API, Google Drive API, and internal API endpoints.
 */
import { http, HttpResponse, delay, bypass } from "msw";

export const handlers = [
  // Google Drive API - Connection status
  http.get("/api/google-drive/*", () => {
    return HttpResponse.json({
      connected: true,
      quota: { used: 5000000000, total: 15000000000 },
      email: "user@example.com",
    });
  }),

  // Internal API - Create item
  http.post("/api/items", async () => {
    await delay(300);
    return HttpResponse.json({
      id: "new-item-123",
      title: "New Item",
      success: true,
    });
  }),

  // Internal API - Create item error
  http.post("/api/items/error", () => {
    return HttpResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }),

  // Internal API - Get items
  http.get("/api/items", async () => {
    await delay(200);
    return HttpResponse.json({
      items: [
        {
          id: "1",
          title: "Movies",
          description: "My movie collection",
          children: [],
        },
        {
          id: "2",
          title: "TV Shows",
          description: "My TV show collection",
          children: [],
        },
      ],
    });
  }),

  // Internal API - User profile
  http.get("/api/user/profile", async () => {
    await delay(200);
    return HttpResponse.json({
      id: "user-123",
      name: "Demo User",
      email: "demo@example.com",
      username: "demouser",
      isPublic: true,
    });
  }),

  // Artwork streaming - proxy TMDB posters for Storybook
  // Use artworkId like "artwork-inception" to get corresponding TMDB poster
  http.get("/api/artwork/:fileId", async ({ params }) => {
    const fileId = params.fileId as string;

    // Map artworkIds to TMDB poster paths
    // Supports both full names (artwork-inception) and short names (artwork-inc)
    const posterMap: Record<string, string> = {
      // Full names (used by GridItem stories)
      "artwork-inception": "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
      "artwork-interstellar": "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      "artwork-dark-knight": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
      "artwork-godfather": "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
      "artwork-breaking-bad": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      "artwork-matrix": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      "artwork-pulp-fiction": "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
      "artwork-lotr": "/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg",
      // Short names (used by SortableGrid stories)
      "artwork-inc": "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", // Inception
      "artwork-gf": "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", // The Godfather
      "artwork-dk": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg", // The Dark Knight
      "artwork-pf": "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", // Pulp Fiction
      "artwork-mx": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", // The Matrix
      "artwork-fc": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg", // Fight Club
      "artwork-fav": "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", // Favourites (use Inception)
      "art-1": "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", // Completed
      "art-2": "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", // In Progress
      "art-3": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg", // New
      "art-v": "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg", // Video
      "art-a": "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg", // Audio
      "art-m": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", // Mixed
    };

    const posterPath = posterMap[fileId];
    if (posterPath) {
      // Fetch the actual image from TMDB using bypass to avoid MSW interception
      try {
        const tmdbUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
        const response = await fetch(bypass(tmdbUrl));
        const imageBuffer = await response.arrayBuffer();
        return new HttpResponse(imageBuffer, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
          },
        });
      } catch {
        // Fallback on fetch error
        return new HttpResponse(null, { status: 404 });
      }
    }

    // Fallback - return 404 for unknown artwork
    return new HttpResponse(null, { status: 404 });
  }),

  // Media streaming - stub for stories that use direct src prop
  http.get("/api/stream/:fileId", async () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
      },
    });
  }),
];
