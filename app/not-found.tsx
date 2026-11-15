import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">This page or draft does not exist. It may have been removed when the demo data was reset.</p>
      <Link href="/drafts" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to drafts
      </Link>
    </div>
  );
}
