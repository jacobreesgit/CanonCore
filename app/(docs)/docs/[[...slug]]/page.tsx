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
  const page = source.getPage(params.slug);
  if (!page) notFound();

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
  return source.generateParams();
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
