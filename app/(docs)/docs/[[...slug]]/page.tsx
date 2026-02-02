/**
 * Dynamic documentation page using Fumadocs.
 * Renders MDX content with proper styling.
 */

import { source } from "@/lib/source";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { createRelativeLink } from "fumadocs-ui/mdx";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * Renders a documentation page from MDX content.
 *
 * @param props - Page props including slug params
 */
export default async function Page(props: PageProps) {
  const params = await props.params;

  // Debug logging for Vercel
  console.log("[DOCS PAGE] Rendering page with slug:", params.slug);
  console.log("[DOCS PAGE] source.getPages() count:", source.getPages().length);

  const page = source.getPage(params.slug);
  console.log("[DOCS PAGE] Found page:", page ? page.url : "NOT FOUND");

  if (!page) {
    console.log("[DOCS PAGE] Page not found, calling notFound()");
    notFound();
  }

  const MDX = page.data.body;

  return (
    <div className="container p-6">
      <article className="prose dark:prose-invert max-w-none">
        <h1>{page.data.title}</h1>
        {page.data.description && (
          <p className="text-muted-foreground text-xl">
            {page.data.description}
          </p>
        )}
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </article>
    </div>
  );
}

/**
 * Generates static params for all documentation pages.
 */
export async function generateStaticParams() {
  const params = source.generateParams();
  console.log("[DOCS generateStaticParams] Generated params count:", params.length);
  console.log("[DOCS generateStaticParams] Params:", JSON.stringify(params));
  return params;
}

/**
 * Generates metadata for documentation pages.
 *
 * @param props - Page props including slug params
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
