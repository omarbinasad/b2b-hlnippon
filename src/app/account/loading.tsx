import { Skeleton } from "@/components/ui/feedback";

export default function AccountLoading() {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-6 h-48 w-full" />
    </div>
  );
}
