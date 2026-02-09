/**
 * Static data constants for cinematic UI components.
 * Wiki sections and About tab filter options.
 */

/** Wiki section for learn more accordion. */
export interface WikiSection {
  id: string;
  title: string;
}

/** Default wiki sections for movies. */
export const MOCK_WIKI_SECTIONS_MOVIE: WikiSection[] = [
  { id: "plot", title: "Plot Summary" },
  { id: "production", title: "Production History" },
  { id: "reception", title: "Critical Reception" },
  { id: "trivia", title: "Trivia & Facts" },
];

/** Default wiki sections for TV shows. */
export const MOCK_WIKI_SECTIONS_TV: WikiSection[] = [
  { id: "plot", title: "Plot Summary" },
  { id: "episodes", title: "Episode Guide" },
  { id: "production", title: "Production History" },
  { id: "reception", title: "Reception & Awards" },
];

/** Section filter options for About tab. */
export const ABOUT_SECTION_FILTER_OPTIONS: { value: string; label: string }[] =
  [
    { value: "all", label: "All Sections" },
    { value: "cast", label: "Cast" },
    { value: "about", label: "About" },
    { value: "providers", label: "Where to Watch" },
    { value: "videos", label: "Videos" },
    { value: "wiki", label: "Learn More" },
    { value: "recommendations", label: "More Like This" },
  ];
