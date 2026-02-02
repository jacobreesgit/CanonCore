/**
 * Design Tokens documentation for CanonCore Design System.
 * Visual showcase of colours, typography, spacing, and other design primitives.
 */
import type { Meta, StoryObj } from "@storybook/nextjs";

// Simple wrapper component for documentation
function DesignTokens() {
  return <div>Design Tokens Documentation</div>;
}

/**
 * Design tokens define the visual language of CanonCore.
 *
 * ## Overview
 * CanonCore uses CSS custom properties for theming consistency across light and dark modes.
 * All tokens automatically adapt when switching between themes.
 *
 * ## Token Categories
 * - **Colours** - Brand, semantic, and state colours
 * - **Typography** - Font families, sizes, weights, line heights
 * - **Spacing** - Consistent spacing scale based on 4px units
 * - **Borders** - Radius values for rounded corners
 * - **Shadows** - Elevation levels for depth
 * - **Z-Index** - Stacking order for layered elements
 * - **Breakpoints** - Responsive design breakpoints
 */
const meta = {
  title: "Design System/Design Tokens",
  component: DesignTokens,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Visual documentation of all design tokens used throughout CanonCore. Toggle between light and dark themes to see how tokens adapt.",
      },
    },
  },
} satisfies Meta<typeof DesignTokens>;

export default meta;
type Story = StoryObj<typeof meta>;

// =============================================================================
// COLOUR PALETTE
// =============================================================================

/**
 * Core colour palette showing all semantic colours.
 * Colours automatically adapt between light and dark modes.
 */
export const ColourPalette: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="mb-4 text-2xl font-semibold">Semantic Colours</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ColourSwatch
            name="Background"
            variable="--background"
            className="bg-background"
          />
          <ColourSwatch
            name="Foreground"
            variable="--foreground"
            className="bg-foreground"
          />
          <ColourSwatch
            name="Primary"
            variable="--primary"
            className="bg-primary"
          />
          <ColourSwatch
            name="Secondary"
            variable="--secondary"
            className="bg-secondary"
          />
          <ColourSwatch name="Muted" variable="--muted" className="bg-muted" />
          <ColourSwatch
            name="Accent"
            variable="--accent"
            className="bg-accent"
          />
          <ColourSwatch name="Card" variable="--card" className="bg-card" />
          <ColourSwatch
            name="Destructive"
            variable="--destructive"
            className="bg-destructive"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold">Border & Ring</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <ColourSwatch
            name="Border"
            variable="--border"
            className="bg-border"
          />
          <ColourSwatch name="Input" variable="--input" className="bg-input" />
          <ColourSwatch name="Ring" variable="--ring" className="bg-ring" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "All semantic colours used in the design system. Each colour has light and dark mode variants.",
      },
    },
  },
};

function ColourSwatch({
  name,
  variable,
  className,
}: {
  name: string;
  variable: string;
  className: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className={`h-16 ${className}`} />
      <div className="bg-card p-3">
        <div className="font-medium">{name}</div>
        <div className="text-muted-foreground font-mono text-xs">
          {variable}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TYPOGRAPHY
// =============================================================================

/**
 * Typography scale showing all text sizes and weights.
 */
export const Typography: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="mb-4 text-2xl font-semibold">Type Scale</h2>
        <div className="space-y-4">
          <TypeSample size="text-xs" label="text-xs (12px)" />
          <TypeSample size="text-sm" label="text-sm (14px)" />
          <TypeSample size="text-base" label="text-base (16px)" />
          <TypeSample size="text-lg" label="text-lg (18px)" />
          <TypeSample size="text-xl" label="text-xl (20px)" />
          <TypeSample size="text-2xl" label="text-2xl (24px)" />
          <TypeSample size="text-3xl" label="text-3xl (30px)" />
          <TypeSample size="text-4xl" label="text-4xl (36px)" />
          <TypeSample size="text-5xl" label="text-5xl (48px)" />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold">Font Weights</h2>
        <div className="space-y-2 text-xl">
          <div className="font-normal">Normal (400) - Body text</div>
          <div className="font-medium">Medium (500) - Labels, buttons</div>
          <div className="font-semibold">Semibold (600) - Headings</div>
          <div className="font-bold">Bold (700) - Emphasis</div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-semibold">Font Families</h2>
        <div className="space-y-4">
          <div>
            <div className="text-muted-foreground mb-1 text-sm">
              Sans (Default)
            </div>
            <div className="font-sans text-lg">
              The quick brown fox jumps over the lazy dog
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1 text-sm">Mono</div>
            <div className="font-mono text-lg">
              const greeting = &quot;Hello, World!&quot;;
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Complete typography scale from text-xs to text-5xl, plus font weights and families.",
      },
    },
  },
};

function TypeSample({ size, label }: { size: string; label: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="text-muted-foreground w-32 shrink-0 font-mono text-xs">
        {label}
      </span>
      <span className={size}>The quick brown fox jumps over the lazy dog</span>
    </div>
  );
}

// =============================================================================
// SPACING
// =============================================================================

/**
 * Spacing scale based on 4px base unit.
 */
export const Spacing: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <h2 className="mb-4 text-2xl font-semibold">Spacing Scale (4px base)</h2>
      <div className="space-y-3">
        {[
          { name: "space-1", value: "4px", class: "w-1" },
          { name: "space-2", value: "8px", class: "w-2" },
          { name: "space-3", value: "12px", class: "w-3" },
          { name: "space-4", value: "16px", class: "w-4" },
          { name: "space-5", value: "20px", class: "w-5" },
          { name: "space-6", value: "24px", class: "w-6" },
          { name: "space-8", value: "32px", class: "w-8" },
          { name: "space-10", value: "40px", class: "w-10" },
          { name: "space-12", value: "48px", class: "w-12" },
          { name: "space-16", value: "64px", class: "w-16" },
        ].map((space) => (
          <div key={space.name} className="flex items-center gap-4">
            <span className="text-muted-foreground w-24 font-mono text-sm">
              {space.name}
            </span>
            <span className="text-muted-foreground w-12 text-sm">
              {space.value}
            </span>
            <div className={`bg-primary h-4 ${space.class}`} />
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Spacing scale based on 4px base unit for consistent vertical rhythm and layout.",
      },
    },
  },
};

// =============================================================================
// BORDER RADIUS
// =============================================================================

/**
 * Border radius values for rounded corners.
 */
export const BorderRadius: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <h2 className="mb-4 text-2xl font-semibold">Border Radius</h2>
      <div className="flex flex-wrap gap-6">
        {[
          { name: "rounded-sm", value: "2px", class: "rounded-sm" },
          { name: "rounded", value: "4px", class: "rounded" },
          { name: "rounded-md", value: "6px", class: "rounded-md" },
          { name: "rounded-lg", value: "8px", class: "rounded-lg" },
          { name: "rounded-xl", value: "12px", class: "rounded-xl" },
          { name: "rounded-2xl", value: "16px", class: "rounded-2xl" },
          { name: "rounded-full", value: "9999px", class: "rounded-full" },
        ].map((radius) => (
          <div key={radius.name} className="text-center">
            <div
              className={`bg-primary text-primary-foreground mb-2 flex h-16 w-16 items-center justify-center ${radius.class}`}
            >
              <span className="text-xs font-medium">{radius.value}</span>
            </div>
            <div className="font-mono text-xs">{radius.name}</div>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Border radius scale from subtle rounding to fully circular elements.",
      },
    },
  },
};

// =============================================================================
// SHADOWS
// =============================================================================

/**
 * Shadow elevation levels.
 */
export const Shadows: Story = {
  render: () => (
    <div className="space-y-8 p-8">
      <h2 className="mb-4 text-2xl font-semibold">Shadows (Elevation)</h2>
      <div className="flex flex-wrap gap-8">
        {[
          { name: "shadow-sm", usage: "Subtle hover states" },
          { name: "shadow", usage: "Cards, buttons" },
          { name: "shadow-md", usage: "Dropdowns, tooltips" },
          { name: "shadow-lg", usage: "Modals, dialogs" },
          { name: "shadow-xl", usage: "Popovers" },
          { name: "shadow-2xl", usage: "Maximum elevation" },
        ].map((shadow) => (
          <div key={shadow.name} className="text-center">
            <div
              className={`bg-card mb-2 flex h-20 w-20 items-center justify-center rounded-lg ${shadow.name}`}
            >
              <span className="text-muted-foreground text-xs">
                {shadow.name}
              </span>
            </div>
            <div className="text-muted-foreground text-xs">{shadow.usage}</div>
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Shadow scale for creating depth and elevation hierarchy in the interface.",
      },
    },
  },
};

// =============================================================================
// Z-INDEX
// =============================================================================

/**
 * Z-index stacking order.
 */
export const ZIndex: Story = {
  render: () => (
    <div className="p-8">
      <h2 className="mb-4 text-2xl font-semibold">Z-Index Scale</h2>
      <div className="relative h-64">
        {[
          { name: "z-0 (Base)", z: 0, color: "bg-muted" },
          { name: "z-10 (Dropdown)", z: 10, color: "bg-blue-500" },
          { name: "z-20 (Sticky)", z: 20, color: "bg-green-500" },
          { name: "z-30 (Fixed)", z: 30, color: "bg-yellow-500" },
          { name: "z-40 (Modal backdrop)", z: 40, color: "bg-orange-500" },
          { name: "z-50 (Modal)", z: 50, color: "bg-red-500" },
        ].map((layer, index) => (
          <div
            key={layer.name}
            className={`absolute flex h-12 w-48 items-center justify-center rounded-lg text-xs font-medium text-white ${layer.color}`}
            style={{
              zIndex: layer.z,
              top: index * 30,
              left: index * 30,
            }}
          >
            {layer.name}
          </div>
        ))}
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Z-index scale for managing stacking order of overlays, modals, and tooltips.",
      },
    },
  },
};

// =============================================================================
// BREAKPOINTS
// =============================================================================

/**
 * Responsive breakpoints.
 */
export const Breakpoints: Story = {
  render: () => (
    <div className="p-8">
      <h2 className="mb-4 text-2xl font-semibold">Responsive Breakpoints</h2>
      <div className="space-y-3">
        {[
          { name: "sm", value: "640px", usage: "Small tablets" },
          { name: "md", value: "768px", usage: "Tablets" },
          { name: "lg", value: "1024px", usage: "Small desktops" },
          { name: "xl", value: "1280px", usage: "Desktop" },
          { name: "2xl", value: "1536px", usage: "Large desktop" },
        ].map((bp) => (
          <div key={bp.name} className="flex items-center gap-4">
            <span className="bg-primary text-primary-foreground w-12 rounded px-2 py-1 text-center font-mono text-sm">
              {bp.name}
            </span>
            <span className="text-muted-foreground w-20 font-mono text-sm">
              {bp.value}
            </span>
            <span className="text-sm">{bp.usage}</span>
            <div
              className="bg-muted h-2 rounded"
              style={{ width: `${parseInt(bp.value) / 20}px` }}
            />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-4 text-sm">
        Use Storybook&apos;s viewport toolbar to preview components at different
        breakpoints.
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Tailwind CSS breakpoints used for responsive design. Mobile-first approach.",
      },
    },
  },
};
