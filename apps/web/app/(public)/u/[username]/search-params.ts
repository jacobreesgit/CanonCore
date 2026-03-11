import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const profileSearchParamsCache = createSearchParamsCache({
  q: parseAsString.withDefault(""),
});
