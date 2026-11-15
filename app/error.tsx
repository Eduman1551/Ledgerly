"use client";
// Shown when a page fails to load (for example the database is unreachable).
// The app never shows a blank crash screen.
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <TriangleAlert className="size-8 text-amber-600" />
      <h1 className="text-xl font-semibold">This page could not load</h1>
      <p className="text-sm text-muted-foreground">
        The server had a problem, most likely with the database connection. Try again. If the demo data looks broken, reset it from Demo tools.
      </p>
      {error.digest && <p className="text-xs text-muted-foreground">Error reference: {error.digest}</p>}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/demo" />}>
          Demo tools
        </Button>
      </div>
    </div>
  );
}
