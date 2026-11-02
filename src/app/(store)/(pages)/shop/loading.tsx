import { Skeleton } from "@/components/ui/feedback";

export default function ShopLoading() {
  return (
    <div role="status" aria-label="Loading products">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}
