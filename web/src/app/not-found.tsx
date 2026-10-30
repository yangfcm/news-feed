import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Link href="/" className="underline underline-offset-4">
        Back to today&apos;s digest
      </Link>
    </main>
  );
}
