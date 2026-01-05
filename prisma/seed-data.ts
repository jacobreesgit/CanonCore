/**
 * Seed data definitions for database seeding.
 * Declarative data structure for movies, TV shows, and music.
 */

import { FileType } from "@prisma/client";

// File size constants (in bytes)
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

/**
 * Represents a file to be seeded for an item.
 */
export interface SeedFile {
  filename: string;
  fileType: FileType;
  mimeType: string;
  size: bigint;
  isPrimary?: boolean;
}

/**
 * Represents an item to be seeded (movie, show, season, episode, album).
 */
export interface SeedItem {
  name: string;
  description: string;
  files: SeedFile[];
  children?: SeedItem[];
}

/**
 * Movies seed data - 10 movies with various file configurations.
 */
export const MOVIES: SeedItem[] = [
  {
    name: "The Shawshank Redemption (1994)",
    description:
      "Two imprisoned men bond over years, finding solace and redemption.",
    files: [
      {
        filename: "The.Shawshank.Redemption.1994.1080p.x264.YIFY.mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(1.6 * GB)),
        isPrimary: true,
      },
      {
        filename:
          "The.Shawshank.Redemption.1994.2160p.4K.BluRay.x265.10bit.HDR.AAC5.1-[YTS.MX].mkv",
        fileType: FileType.MEDIA,
        mimeType: "video/x-matroska",
        size: BigInt(Math.floor(6.9 * GB)),
      },
      {
        filename: "poster.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(272 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(177 * KB),
      },
      {
        filename: "banner.jpeg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(949 * KB),
      },
      {
        filename: "The.Shawshank.Redemption.1994.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(136 * KB),
        isPrimary: true,
      },
      {
        filename: "The.Shawshank.Redemption.1994.es.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(122 * KB),
      },
      {
        filename: "The.Shawshank.Redemption.1994.fr.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(112 * KB),
      },
    ],
  },
  {
    name: "Inception (2010)",
    description:
      "A thief who steals secrets through dream invasion is offered redemption.",
    files: [
      {
        filename: "Inception.2010.1080p.BrRip.x264.YIFY.mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(1.9 * GB)),
        isPrimary: true,
      },
      {
        filename: "poster.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(305 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(Math.floor(1.4 * MB)),
      },
      {
        filename: "Inception.2010.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(133 * KB),
        isPrimary: true,
      },
      {
        filename: "Inception.2010.es.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(75 * KB),
      },
    ],
  },
  {
    name: "Interstellar (2014)",
    description:
      "Explorers travel through a wormhole in space to ensure humanity's survival.",
    files: [
      {
        filename: "Interstellar.2014.2014.1080p.BluRay.x264.YIFY.mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(2.3 * GB)),
        isPrimary: true,
      },
      {
        filename: "poster.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(816 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(291 * KB),
      },
      {
        filename: "banner.jpeg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(Math.floor(7.1 * KB)),
      },
      {
        filename: "logo.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(35 * KB),
      },
      {
        filename: "Interstellar.2014.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(150 * KB),
        isPrimary: true,
      },
    ],
  },
  {
    name: "The Dark Knight (2008)",
    description:
      "Batman faces the Joker in one of the greatest tests of his abilities.",
    files: [
      {
        filename: "Batman.The.Dark.Knight.2008.1080p.BluRay.x264.YIFY.mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(1.7 * GB)),
        isPrimary: true,
      },
      {
        filename:
          "The.Dark.Knight.2008.IMAX.1080p.10bit.BluRay.6CH.x265.HEVC-PSA.mkv",
        fileType: FileType.MEDIA,
        mimeType: "video/x-matroska",
        size: BigInt(Math.floor(3.5 * GB)),
      },
      {
        filename: "poster.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(376 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.webp",
        fileType: FileType.ARTWORK,
        mimeType: "image/webp",
        size: BigInt(263 * KB),
      },
      {
        filename: "The.Dark.Knight.2008.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(139 * KB),
        isPrimary: true,
      },
    ],
  },
  {
    name: "Pulp Fiction (1994)",
    description: "The lives of two mob hitmen, a boxer, and others intertwine.",
    files: [
      {
        filename: "Pulp.Fiction.1994.1080p.BrRip.x264.YIFY.mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(1.4 * GB)),
        isPrimary: true,
      },
    ],
  },
  {
    name: "Parasite (2019)",
    description: "A poor family schemes to infiltrate a wealthy household.",
    files: [
      {
        filename: "Parasite.2019.1080p.BluRay.x264-[YTS.LT].mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(2.1 * GB)),
        isPrimary: true,
      },
      {
        filename: "poster.jpeg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(10 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(381 * KB),
      },
      {
        filename: "Gisaengchung.2019.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(114 * KB),
        isPrimary: true,
      },
      {
        filename: "Gisaengchung.2019.es.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(119 * KB),
      },
      {
        filename: "Gisaengchung.2019.fr.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(121 * KB),
      },
      {
        filename: "Gisaengchung.albanian.sq.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(115 * KB),
      },
    ],
  },
  {
    name: "Spider-Man No Way Home (2021)",
    description:
      "Peter Parker seeks help from Doctor Strange when his identity is revealed.",
    files: [
      {
        filename:
          "Spider-Man.No.Way.Home.2021.1080p.WEBRip.x264.AAC5.1-[YTS.MX].mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(2.7 * GB)),
        isPrimary: true,
      },
      {
        filename: "poster.jpeg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(14 * KB),
        isPrimary: true,
      },
      {
        filename:
          "Spider-Man.No.Way.Home.2021.1080p.WEBRip.x264.AAC5.1-[YTS.MX].srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(131 * KB),
        isPrimary: true,
      },
    ],
  },
  {
    name: "Dune (2021)",
    description:
      "Paul Atreides must travel to the most dangerous planet in the universe.",
    files: [
      {
        filename: "Dune.2021.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(2.9 * GB)),
        isPrimary: true,
      },
      {
        filename: "Dune.2021.2160p.4K.WEB.x265.10bit.HDR.AAC5.1-[YTS.MX].mkv",
        fileType: FileType.MEDIA,
        mimeType: "video/x-matroska",
        size: BigInt(Math.floor(6.9 * GB)),
      },
      {
        filename: "Dune.2021.720p.BluRay.x264.AAC-[YTS.MX].mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(1.4 * GB)),
      },
      {
        filename: "poster.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(126 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(Math.floor(1.3 * MB)),
      },
      {
        filename: "Dune.2021.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(83 * KB),
        isPrimary: true,
      },
      {
        filename: "Dune.2021.es.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(80 * KB),
      },
    ],
  },
  {
    name: "Oppenheimer (2023)",
    description:
      "The story of J. Robert Oppenheimer and the creation of the atomic bomb.",
    files: [
      {
        filename: "Oppenheimer.2023.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(3.3 * GB)),
        isPrimary: true,
      },
      {
        filename: "poster.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(265 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.jpeg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(16 * KB),
      },
      {
        filename: "Oppenheimer.English.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(194 * KB),
        isPrimary: true,
      },
      {
        filename: "Oppenheimer.English.sdh..en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(265 * KB),
      },
      {
        filename: "Oppenheimer.2023.es.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(216 * KB),
      },
    ],
  },
  {
    name: "Barbie (2023)",
    description:
      "Barbie suffers a crisis that leads her to question her world and existence.",
    files: [
      {
        filename: "Barbie.2023.1080p.BluRay.x264.AAC5.1-[YTS.MX].mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(Math.floor(2.1 * GB)),
        isPrimary: true,
      },
      {
        filename: "poster.jpg.webp",
        fileType: FileType.ARTWORK,
        mimeType: "image/webp",
        size: BigInt(216 * KB),
        isPrimary: true,
      },
      {
        filename: "Barbie.English.en.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
        size: BigInt(153 * KB),
        isPrimary: true,
      },
    ],
  },
];

/**
 * TV Shows seed data - 5 shows with seasons and episodes.
 */
export const TV_SHOWS: SeedItem[] = [
  {
    name: "Breaking Bad",
    description:
      "A chemistry teacher turns to manufacturing meth after his cancer diagnosis.",
    files: [],
    children: [
      {
        name: "Season 1",
        description:
          "Walter White begins his transformation from teacher to drug manufacturer.",
        files: [
          {
            filename: "poster.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(177 * KB),
            isPrimary: true,
          },
          {
            filename: "fanart.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(72 * KB),
          },
          {
            filename: "banner.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(56 * KB),
          },
        ],
        children: [
          {
            name: "S01E01 - Pilot",
            description:
              "Diagnosed with cancer, Walter partners with Jesse to cook meth.",
            files: [
              {
                filename: "Breaking.Bad.S01E01.1080p.BluRay.x265-RARBG.mp4",
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(927 * MB),
                isPrimary: true,
              },
              {
                filename:
                  "Breaking.Bad.S01E01.2160p.NF.WEB-DL.DTS-HD.MA.5.1.HEVC-CRFW.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(5.8 * GB)),
              },
              {
                filename: "Breaking.Bad.s01e01.en.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(48 * KB),
                isPrimary: true,
              },
              {
                filename: "Breaking.Bad.S01E01.es.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(44 * KB),
              },
            ],
          },
          {
            name: "S01E02 - Cat's in the Bag",
            description:
              "Walt and Jesse must deal with the aftermath of their first cook.",
            files: [
              {
                filename: "Breaking.Bad.S01E02.1080p.BluRay.x265-RARBG.mp4",
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(770 * MB),
                isPrimary: true,
              },
              {
                filename: "Breaking.Bad.s01e02.en.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(48 * KB),
                isPrimary: true,
              },
            ],
          },
          {
            name: "S01E03 - And the Bag's in the River",
            description: "Walter faces a difficult decision about Krazy-8.",
            files: [
              {
                filename: "Breaking.Bad.S01E03.1080p.BluRay.x265-RARBG.mp4",
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(769 * MB),
                isPrimary: true,
              },
              {
                filename: "Breaking.Bad.s01e03.en.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(48 * KB),
                isPrimary: true,
              },
            ],
          },
        ],
      },
      {
        name: "Season 2",
        description: "The consequences of Walt's choices begin to unfold.",
        files: [
          {
            filename: "poster.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(449 * KB),
            isPrimary: true,
          },
        ],
        children: [
          {
            name: "S02E01 - Seven Thirty-Seven",
            description: "Walt and Jesse face the aftermath of Tuco's death.",
            files: [
              {
                filename: "Breaking.Bad.S02E01.1080p.BluRay.x265-RARBG.mp4",
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(754 * MB),
                isPrimary: true,
              },
              {
                filename: "Breaking.Bad.S02E01.en.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(33 * KB),
                isPrimary: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Stranger Things",
    description:
      "A group of kids encounter supernatural forces in their small town.",
    files: [],
    children: [
      {
        name: "Season 1",
        description:
          "The disappearance of Will Byers exposes a dark secret in Hawkins.",
        files: [
          {
            filename: "poster.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(714 * KB),
            isPrimary: true,
          },
          {
            filename: "fanart.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(227 * KB),
          },
        ],
        children: [
          {
            name: "S01E01 - The Vanishing of Will Byers",
            description:
              "Will Byers mysteriously disappears, and his friends begin to search.",
            files: [
              {
                filename:
                  "Stranger.Things.S01E01.1080p.BluRay.x264-SHORTBREHD.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(3.3 * GB)),
                isPrimary: true,
              },
              {
                filename:
                  "Stranger.Things.S01E01.2160p.UHD.BluRay.x265-DEPTH.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(9.0 * GB)),
              },
              {
                filename: "thumb.jpg",
                fileType: FileType.ARTWORK,
                mimeType: "image/jpeg",
                size: BigInt(Math.floor(8.0 * MB)),
                isPrimary: true,
              },
              {
                filename: "title.webp",
                fileType: FileType.ARTWORK,
                mimeType: "image/webp",
                size: BigInt(Math.floor(1.7 * KB)),
              },
              {
                filename:
                  "Stranger.Things.S01E01.1080p.BluRay.x264-SHORTBREHD.sub",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(Math.floor(4.7 * MB)),
                isPrimary: true,
              },
              {
                filename: "Stranger.Things.S01E01.es.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(43 * KB),
              },
              {
                filename: "Stranger.Things.S01E01.fr.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(31 * KB),
              },
            ],
          },
          {
            name: "S01E02 - The Weirdo on Maple Street",
            description:
              "The boys discover a strange girl in the woods with unusual abilities.",
            files: [
              {
                filename:
                  "Stranger.Things.S01E02.1080p.BluRay.x264-SHORTBREHD.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(4.4 * GB)),
                isPrimary: true,
              },
              {
                filename:
                  "Stranger.Things.S01E02.1080p.BluRay.x264-SHORTBREHD.sub",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(Math.floor(4.7 * MB)),
                isPrimary: true,
              },
            ],
          },
          {
            name: "S01E03 - Holly, Jolly",
            description:
              "Joyce communicates with Will through Christmas lights.",
            files: [
              {
                filename:
                  "Stranger.Things.S01E03.1080p.BluRay.x264-SHORTBREHD.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(3.3 * GB)),
                isPrimary: true,
              },
              {
                filename:
                  "Stranger.Things.S01E03.1080p.BluRay.x264-SHORTBREHD.sub",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(Math.floor(3.6 * MB)),
                isPrimary: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "The Office",
    description:
      "The daily lives of office employees at Wernham Hogg paper company.",
    files: [],
    children: [
      {
        name: "Season 1",
        description:
          "David Brent manages his staff with delusions of being a brilliant boss.",
        files: [
          {
            filename: "poster.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(49 * KB),
            isPrimary: true,
          },
        ],
        children: [
          {
            name: "S01E01 - Pilot",
            description: "Documentary crew begins filming at Wernham Hogg.",
            files: [
              {
                filename: "The.Office.UK.S01E01.1080p.WEBRip.x265-RARBG.mp4",
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(474 * MB),
                isPrimary: true,
              },
              {
                filename: "2_English.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(43 * KB),
                isPrimary: true,
              },
            ],
          },
          {
            name: "S01E02 - Diversity Day",
            description:
              "David runs a diversity seminar after a corporate memo.",
            files: [
              {
                filename: "The.Office.UK.S01E02.1080p.WEBRip.x265-RARBG.mp4",
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(470 * MB),
                isPrimary: true,
              },
            ],
          },
          {
            name: "S01E03 - Health Care",
            description:
              "David tasks Gareth with choosing a health care plan for the office.",
            files: [
              {
                filename: "The.Office.UK.S01E03.1080p.WEBRip.x265-RARBG.mp4",
                fileType: FileType.MEDIA,
                mimeType: "video/mp4",
                size: BigInt(474 * MB),
                isPrimary: true,
              },
              {
                filename: "2_English.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(41 * KB),
                isPrimary: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Game of Thrones",
    description:
      "Noble families vie for control of the Iron Throne of Westeros.",
    files: [],
    children: [
      {
        name: "Season 1",
        description:
          "Eddard Stark is appointed Hand of the King and uncovers dark secrets.",
        files: [
          {
            filename: "poster.jpeg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(8 * KB),
            isPrimary: true,
          },
          {
            filename: "fanart.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(143 * KB),
          },
          {
            filename: "banner.jpg",
            fileType: FileType.ARTWORK,
            mimeType: "image/jpeg",
            size: BigInt(53 * KB),
          },
        ],
        children: [
          {
            name: "S01E01 - Winter Is Coming",
            description:
              "King Robert arrives at Winterfell to ask Ned to be his Hand.",
            files: [
              {
                filename:
                  "Game of Thrones S01E01 1080p BluRay DTS x264-LiNG.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(8.4 * GB)),
                isPrimary: true,
              },
              {
                filename:
                  "Game of Thrones S01E01 Winter Is Coming REPACK 2160p MAX WEB-DL TrueHD 7 1 Atmos DV HDR H 265-Kitsune.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(11.3 * GB)),
              },
              {
                filename: "thumb.jpg",
                fileType: FileType.ARTWORK,
                mimeType: "image/jpeg",
                size: BigInt(Math.floor(1.3 * MB)),
                isPrimary: true,
              },
              {
                filename: "title.jpg",
                fileType: FileType.ARTWORK,
                mimeType: "image/jpeg",
                size: BigInt(55 * KB),
              },
              {
                filename: "Game.of.Thrones.S01E01.en.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(44 * KB),
                isPrimary: true,
              },
              {
                filename: "Game.of.Thrones.S01E01.es.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(37 * KB),
              },
              {
                filename: "Game.of.Thrones.S01E01.fr.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(41 * KB),
              },
              {
                filename: "Game.of.Thrones.S01E01.de.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(42 * KB),
              },
            ],
          },
          {
            name: "S01E02 - The Kingsroad",
            description:
              "Ned and his daughters travel to King's Landing with the royal family.",
            files: [
              {
                filename:
                  "Game of Thrones S01E02 1080p BluRay DTS x264-LiNG.mkv",
                fileType: FileType.MEDIA,
                mimeType: "video/x-matroska",
                size: BigInt(Math.floor(5.6 * GB)),
                isPrimary: true,
              },
              {
                filename: "Game.of.Thrones.S01E02.en.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(44 * KB),
                isPrimary: true,
              },
              {
                filename: "Game.of.Thrones.S01E02.es.srt",
                fileType: FileType.SUBTITLE,
                mimeType: "application/x-subrip",
                size: BigInt(80 * KB),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "The Mandalorian",
    description:
      "A lone bounty hunter makes his way through the outer reaches of the galaxy.",
    files: [],
    children: [],
  },
];

/**
 * Music seed data - 2 albums with tracks.
 */
export const MUSIC: SeedItem[] = [
  {
    name: "Pink Floyd - The Dark Side of the Moon",
    description:
      "1973 progressive rock masterpiece exploring themes of time and mortality.",
    files: [
      {
        filename:
          "Pink Floyd - The Dark Side of the Moon - 01 - Speak to Me.flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(41 * MB),
        isPrimary: true,
      },
      {
        filename:
          "Pink Floyd - The Dark Side of the Moon - 02 - Breathe (in the Air).flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(104 * MB),
      },
      {
        filename:
          "Pink Floyd - The Dark Side of the Moon - 03 - On the Run.flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(131 * MB),
      },
      {
        filename: "Pink Floyd - The Dark Side of the Moon - 04 - Time.flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(266 * MB),
      },
      {
        filename:
          "Pink Floyd - The Dark Side of the Moon - 05 - The Great Gig in the Sky.flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(171 * MB),
      },
      {
        filename: "cover.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(23 * KB),
        isPrimary: true,
      },
      {
        filename: "back.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(67 * KB),
      },
      {
        filename: "cd.webp",
        fileType: FileType.ARTWORK,
        mimeType: "image/webp",
        size: BigInt(220 * KB),
      },
    ],
  },
  {
    name: "Daft Punk - Random Access Memories",
    description:
      "2013 Grammy-winning album blending disco and electronic music.",
    files: [
      {
        filename:
          "Daft Punk_Random Access Memories_01-01_Give Life Back to Music.flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(30 * MB),
        isPrimary: true,
      },
      {
        filename:
          "Daft Punk_Random Access Memories_01-02_The Game of Love.flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(31 * MB),
      },
      {
        filename:
          "Daft Punk_Random Access Memories_01-03_Giorgio by Moroder.flac",
        fileType: FileType.MEDIA,
        mimeType: "audio/flac",
        size: BigInt(56 * MB),
      },
      {
        filename: "cover.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(35 * KB),
        isPrimary: true,
      },
      {
        filename: "fanart.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(121 * KB),
      },
    ],
  },
  {
    name: "Favorites",
    description: "Your hand-picked favorite tracks.",
    files: [],
  },
];
