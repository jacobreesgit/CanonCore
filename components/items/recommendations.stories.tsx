/**
 * Stories for Recommendations component.
 * Poster grid of similar movies/shows from TMDB data.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { Recommendations } from "./recommendations";
import type { Recommendation } from "@/lib/tmdb-client";

const meta = {
  title: "Items/About/Recommendations",
  component: Recommendations,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'Displays a grid of recommendation poster cards from TMDB data. Each card shows a "Add to Library" toast on click. Uses real TMDB poster paths for authentic poster imagery.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-5xl p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Recommendations>;

export default meta;
type Story = StoryObj<typeof meta>;

// Real TMDB recommendation data (similar to Inception)
const INCEPTION_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 272,
    title: "Batman Begins",
    posterPath: "/8RW2runSEc34IwKN2D1eFcZGnfQ.jpg",
    backdropPath: "/5Fy8cKJ0UmOGaOgjaayF5qgPkEp.jpg",
    mediaType: "movie",
  },
  {
    id: 49026,
    title: "The Dark Knight Rises",
    posterPath: "/hr0L2aueqlP2BYUblTTjmtn0hw4.jpg",
    backdropPath: "/f6ljQGv7WnJuwBPty017oPWfqjt.jpg",
    mediaType: "movie",
  },
  {
    id: 157336,
    title: "Interstellar",
    posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdropPath: "/xJHokMbljvjADYdit5fK1DDNfXj.jpg",
    mediaType: "movie",
  },
  {
    id: 68718,
    title: "Django Unchained",
    posterPath: "/7oWY8VDWW7thTzWh3OKYRkWUlD5.jpg",
    backdropPath: "/2oZklIzUbvZXXzIFzv7Hi68d6xf.jpg",
    mediaType: "movie",
  },
  {
    id: 550,
    title: "Fight Club",
    posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    backdropPath: "/hZkgoQYus5dXo3H8T7Uef6DNknx.jpg",
    mediaType: "movie",
  },
  {
    id: 13,
    title: "Forrest Gump",
    posterPath: "/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
    backdropPath: "/7c9UVPPiTPltouxRVY6N9uugaVA.jpg",
    mediaType: "movie",
  },
  {
    id: 120,
    title: "The Lord of the Rings: The Fellowship of the Ring",
    posterPath: "/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg",
    backdropPath: "/x2RS3uTcsJJ9IfjNPcgDmukoEcQ.jpg",
    mediaType: "movie",
  },
  {
    id: 155,
    title: "The Dark Knight",
    posterPath: "/qJ2tW6WMUDux911BTUgMe1MBrTc.jpg",
    backdropPath: "/nMKdUUepR0i5zn0y1T4CsSB5ez.jpg",
    mediaType: "movie",
  },
  {
    id: 680,
    title: "Pulp Fiction",
    posterPath: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    backdropPath: "/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg",
    mediaType: "movie",
  },
  {
    id: 603,
    title: "The Matrix",
    posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    backdropPath: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
    mediaType: "movie",
  },
  {
    id: 238,
    title: "The Godfather",
    posterPath: "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    backdropPath: "/tmU7GeKVybMWFButWEGl2M4GeiP.jpg",
    mediaType: "movie",
  },
  {
    id: 278,
    title: "The Shawshank Redemption",
    posterPath: "/9cjIGRPFUijNVgqbiBKGORIFHkJ.jpg",
    backdropPath: "/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg",
    mediaType: "movie",
  },
];

// TV show recommendations (similar to Breaking Bad)
const TV_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 63351,
    title: "Better Call Saul",
    posterPath: "/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg",
    backdropPath: "/k5EzIAOjA8EJ9rkWJLftpM8pVss.jpg",
    mediaType: "tv",
  },
  {
    id: 1396,
    title: "Breaking Bad",
    posterPath: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    backdropPath: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    mediaType: "tv",
  },
  {
    id: 1399,
    title: "Game of Thrones",
    posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
    backdropPath: "/suopoADq0k8YZr4dQXcU6pToj6s.jpg",
    mediaType: "tv",
  },
  {
    id: 66732,
    title: "Stranger Things",
    posterPath: "/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
    backdropPath: "/rcA17r3hfHtRrk3Ofqhci0yRMAd.jpg",
    mediaType: "tv",
  },
  {
    id: 44217,
    title: "Vikings",
    posterPath: "/bQLrHIRNEVE21G0fRjlIBvJ8cp9.jpg",
    backdropPath: "/aq2yEMgRQBPfRkrO0Repo2qhUAT.jpg",
    mediaType: "tv",
  },
  {
    id: 1402,
    title: "The Walking Dead",
    posterPath: "/xf9wuDcqlUPWABZNeDKPbZUjWx0.jpg",
    backdropPath: "/wvdWb5kTQipdMf6EvjMIoELCK3k.jpg",
    mediaType: "tv",
  },
];

/** Full grid of movie recommendations (12 items, similar to Inception). */
export const MovieRecommendations: Story = {
  args: {
    recommendations: INCEPTION_RECOMMENDATIONS,
  },
};

/** TV show recommendations (6 items). */
export const TVRecommendations: Story = {
  args: {
    recommendations: TV_RECOMMENDATIONS,
    title: "Similar Shows",
  },
};

/** Small set of recommendations (3 items). */
export const FewRecommendations: Story = {
  args: {
    recommendations: INCEPTION_RECOMMENDATIONS.slice(0, 3),
  },
};

/** No poster images — shows title initial fallback. */
export const NoPosterImages: Story = {
  args: {
    recommendations: INCEPTION_RECOMMENDATIONS.slice(0, 6).map((rec) => ({
      ...rec,
      posterPath: null,
    })),
  },
  parameters: {
    docs: {
      description: {
        story:
          "When TMDB poster images are unavailable, cards display the first letter of the title as a fallback.",
      },
    },
  },
};
