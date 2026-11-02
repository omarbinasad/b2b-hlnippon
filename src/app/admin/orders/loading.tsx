import { Skeleton } from "@/components/ui/feedback";

export default function OrdersLoading() {
  return (
    <div role="status" aria-label="Loading orders">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="mt-6 h-24 w-full" />
      <div className="mt-4 space-y-2 rounded-ui border border-line p-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
