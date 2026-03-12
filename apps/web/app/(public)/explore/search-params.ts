import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const exploreSearchParamsCache = createSearchParamsCache({
  q: parseAsString.withDefault(""),
});
