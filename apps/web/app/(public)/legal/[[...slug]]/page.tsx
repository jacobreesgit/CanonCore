/**
 * Dynamic legal page using Fumadocs.
 * Renders MDX content with proper styling.
 */

import { legalSource } from "@/lib/source";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { createRelativeLink } from "fumadocs-ui/mdx";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const page = legalSource.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <div className="container p-6">
      <article className="prose prose-invert max-w-none">
        <h1 className="text-pretty">{page.data.title}</h1>
        {page.data.description && (
          <p className="text-muted-foreground text-xl">
            {page.data.description}
          </p>
        )}
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(legalSource, page),
          })}
        />
      </article>
    </div>
  );
}

export async function generateStaticParams() {
  return legalSource.generateParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const page = legalSource.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
