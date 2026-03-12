/**
 * Storybook manager configuration file.
 * Customises the Storybook UI theme and sidebar behaviour.
 */
import { addons } from "storybook/manager-api";
import { create } from "storybook/theming/create";

const theme = create({
  base: "dark",
  brandTitle: "CanonCore Design System",
  brandUrl: "https://canoncore.com",
  brandTarget: "_self",
});

addons.setConfig({
  theme,
  sidebar: {
    showRoots: true,
  },
});
