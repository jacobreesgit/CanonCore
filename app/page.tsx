import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <section className="py-32">
      <div className="border-muted overflow-hidden border-b">
        <div className="container">
          <div className="mx-auto flex max-w-5xl flex-col items-center">
            <div className="z-10 items-center text-center">
              <h1 className="mb-8 text-4xl font-semibold text-pretty lg:text-7xl">
                Welcome to CanonCore
              </h1>
              <p className="text-muted-foreground mx-auto max-w-3xl lg:text-xl">
                Your all-in-one dashboard for managing and analyzing your data.
                Get started today and unlock powerful insights.
              </p>
              <div className="mt-12 flex w-full flex-col justify-center gap-2 sm:flex-row">
                <Button asChild>
                  <Link href="/sign-up">
                    Get started now
                    <ChevronRight className="ml-2 h-4" />
                  </Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/sign-in">
                    Sign in
                    <ChevronRight className="ml-2 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <Image
            src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-1.svg"
            alt="Dashboard preview"
            width={1200}
            height={700}
            className="mx-auto mt-24 max-h-[700px] w-full max-w-7xl rounded-t-lg object-cover shadow-lg"
          />
        </div>
      </div>
    </section>
  );
}
