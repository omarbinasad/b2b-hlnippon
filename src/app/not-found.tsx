import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid flex-1 place-items-center px-4 py-24 text-center">
      <div>
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">The page you are looking for does not exist or has moved.</p>
        <ButtonLink href="/" className="mt-6">
          Back to store
        </ButtonLink>
      </div>
    </main>
  );
}
