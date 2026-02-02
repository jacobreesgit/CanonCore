/**
 * Storybook stories for the Shader1 component.
 * Covers WebGL shader background with various configurations.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Shader1 } from "./shader1";

/**
 * Animated WebGL shader background component.
 *
 * ## Features
 * - 3D animated shader effect using Three.js
 * - Customizable base colour
 * - Custom vertex/fragment shaders supported
 * - Respects prefers-reduced-motion (shows static gradient)
 * - Full-screen absolute positioning
 *
 * ## Accessibility
 * When `prefers-reduced-motion` is enabled, displays a static
 * gradient instead of the animated shader.
 */
const meta = {
  title: "Items/Misc/HeroShaderFallback",
  component: Shader1,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Animated WebGL shader background using Three.js. Falls back to static gradient when prefers-reduced-motion is enabled.",
      },
    },
  },
  argTypes: {
    color: {
      control: "color",
      description: "Base colour for the shader effect",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
  decorators: [
    (Story) => (
      <div className="relative h-[500px] w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Shader1>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Fallback shader background when item has no hero image.
 */
export const Default: Story = {
  args: {
    color: "#0000ff",
  },
};
