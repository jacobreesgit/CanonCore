/**
 * Stories for AboutTabContent component.
 * TMDB metadata sections with section filter toolbar.
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import { AboutTabContent } from "./about-tab-content";
import type { TmdbItemDetails } from "@/lib/tmdb-client";

const meta = {
  title: "Items/About/AboutTabContent",
  component: AboutTabContent,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "About tab content for item detail pages. Renders TMDB metadata sections (cast, description, providers, videos, wiki, recommendations) with a section filter toolbar. Each section lazy-loads with `next/dynamic`.",
      },
    },
  },
} satisfies Meta<typeof AboutTabContent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Real TMDB data for Inception (2010)
const INCEPTION_DETAILS: TmdbItemDetails = {
  cast: [
    {
      id: 6193,
      name: "Leonardo DiCaprio",
      character: "Dom Cobb",
      profilePath: "/wo2hJpn04vbtmh0B9utCFa3qfF6.jpg",
    },
    {
      id: 24045,
      name: "Joseph Gordon-Levitt",
      character: "Arthur",
      profilePath: "/zSuXCR6xCKIgo9aUBsj28sTGa.jpg",
    },
    {
      id: 2524,
      name: "Tom Hardy",
      character: "Eames",
      profilePath: "/yVGF9FvDxTDPhGimTbZNfghpllA.jpg",
    },
    {
      id: 27578,
      name: "Ken Watanabe",
      character: "Saito",
      profilePath: "/psAXOYp9SBOXvg55lmFqGVRpmii.jpg",
    },
    {
      id: 17419,
      name: "Elliot Page",
      character: "Ariadne",
      profilePath: "/dKKBMoTrFdqSHiU0mhRkBYjsPa2.jpg",
    },
    {
      id: 3895,
      name: "Michael Caine",
      character: "Miles",
      profilePath: "/bGZn5RBzLEO0KZ28mTqNl6gmWGo.jpg",
    },
    {
      id: 2037,
      name: "Cillian Murphy",
      character: "Robert Fischer",
      profilePath: "/dm6V24JJJVKB0GXbhOit029Y6I0.jpg",
    },
    {
      id: 95697,
      name: "Tom Berenger",
      character: "Browning",
      profilePath: "/mYqbreBkV2hOlzJy5FqxPbnYr0n.jpg",
    },
    {
      id: 526,
      name: "Marion Cotillard",
      character: "Mal",
      profilePath: "/ksHHxxqPWJMpMRCWljAjMxPIGIH.jpg",
    },
    {
      id: 11357,
      name: "Dileep Rao",
      character: "Yusuf",
      profilePath: "/oQGqDPCz1FBOmexHslMnoc5vdkz.jpg",
    },
  ],
  providers: [
    {
      providerId: 8,
      providerName: "Netflix",
      logoPath: "/pbpMk2JmcoNnQwx5JGpXBGjIAlk.jpg",
    },
    {
      providerId: 337,
      providerName: "Disney Plus",
      logoPath: "/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg",
    },
    {
      providerId: 2,
      providerName: "Apple TV",
      logoPath: "/peURlLlr8jggOwK53fJ5wdQl05y.jpg",
    },
    {
      providerId: 3,
      providerName: "Google Play Movies",
      logoPath: "/tbEdFQDwx5LEVr8WpSeXQSIirVq.jpg",
    },
  ],
  videos: [
    {
      id: "v1",
      key: "YoHD9XEInc0",
      name: "Inception - Official Trailer",
      type: "Trailer",
      site: "YouTube",
    },
    {
      id: "v2",
      key: "66TuSJo4dZM",
      name: "Inception - Behind the Scenes",
      type: "Featurette",
      site: "YouTube",
    },
  ],
  recommendations: [
    {
      id: 272,
      title: "Batman Begins",
      posterPath: "/8RW2runSEc34IwKN2D1eFcZGnfQ.jpg",
      backdropPath: null,
      mediaType: "movie",
    },
    {
      id: 157336,
      title: "Interstellar",
      posterPath: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      backdropPath: null,
      mediaType: "movie",
    },
    {
      id: 155,
      title: "The Dark Knight",
      posterPath: "/qJ2tW6WMUDux911BTUgMe1MBrTc.jpg",
      backdropPath: null,
      mediaType: "movie",
    },
    {
      id: 550,
      title: "Fight Club",
      posterPath: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      backdropPath: null,
      mediaType: "movie",
    },
    {
      id: 603,
      title: "The Matrix",
      posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      backdropPath: null,
      mediaType: "movie",
    },
    {
      id: 680,
      title: "Pulp Fiction",
      posterPath: "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
      backdropPath: null,
      mediaType: "movie",
    },
  ],
};

const INCEPTION_DESCRIPTION =
  "Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life as payment for a task considered to be impossible: \"inception\", the implantation of another person's idea into a target's subconscious.";

/** Full About tab with all TMDB sections (Inception). */
export const FullContent: Story = {
  args: {
    description: INCEPTION_DESCRIPTION,
    tmdbDetails: INCEPTION_DETAILS,
    tmdbDisplayOptions: {
      showTagline: true,
      showMetadata: true,
      showGenres: true,
      showCast: true,
      showProviders: true,
      showVideos: true,
      showRecommendations: true,
    },
    isTV: false,
  },
};

/** TV show variant — uses TV wiki sections. */
export const TVShow: Story = {
  args: {
    description:
      "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
    tmdbDetails: {
      cast: [
        {
          id: 17419,
          name: "Bryan Cranston",
          character: "Walter White",
          profilePath: "/7Jahy5LZX2Fo8fGJltMreAI49hC.jpg",
        },
        {
          id: 17420,
          name: "Aaron Paul",
          character: "Jesse Pinkman",
          profilePath: "/8Kce1HMfMD30RfjEQKYRnUo1eMT.jpg",
        },
        {
          id: 29996,
          name: "Anna Gunn",
          character: "Skyler White",
          profilePath: "/adppyeu1a4REN3khtgmXVMcHKXE.jpg",
        },
        {
          id: 14329,
          name: "Dean Norris",
          character: "Hank Schrader",
          profilePath: "/500eNhXYeDIquF7pGFbIXYq2EjS.jpg",
        },
        {
          id: 59410,
          name: "Betsy Brandt",
          character: "Marie Schrader",
          profilePath: "/zmHDMy0CkNPnAgRsMKRXh1S2rpJ.jpg",
        },
      ],
      providers: [
        {
          providerId: 8,
          providerName: "Netflix",
          logoPath: "/pbpMk2JmcoNnQwx5JGpXBGjIAlk.jpg",
        },
      ],
      videos: [
        {
          id: "v1",
          key: "HhesaQXLuRY",
          name: "Breaking Bad - Official Trailer",
          type: "Trailer",
          site: "YouTube",
        },
      ],
      recommendations: [
        {
          id: 63351,
          title: "Better Call Saul",
          posterPath: "/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg",
          backdropPath: null,
          mediaType: "tv",
        },
        {
          id: 1399,
          title: "Game of Thrones",
          posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
          backdropPath: null,
          mediaType: "tv",
        },
      ],
    },
    tmdbDisplayOptions: {
      showTagline: true,
      showMetadata: true,
      showGenres: true,
      showCast: true,
      showProviders: true,
      showVideos: true,
      showRecommendations: true,
    },
    isTV: true,
  },
};

/** Description only — no TMDB data linked. */
export const DescriptionOnly: Story = {
  args: {
    description: INCEPTION_DESCRIPTION,
    tmdbDetails: null,
    isTV: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When no TMDB data is linked, only the description and wiki placeholder sections are shown.",
      },
    },
  },
};

/** Some sections hidden via display options. */
export const PartialSections: Story = {
  args: {
    description: INCEPTION_DESCRIPTION,
    tmdbDetails: INCEPTION_DETAILS,
    tmdbDisplayOptions: {
      showTagline: true,
      showMetadata: true,
      showGenres: true,
      showCast: true,
      showProviders: false,
      showVideos: false,
      showRecommendations: false,
    },
    isTV: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Users can toggle individual TMDB sections. Here providers, videos, and recommendations are hidden.",
      },
    },
  },
};
