import { Skeleton } from "@/components/ui/feedback";
import { LoadingMark } from "@/components/ui/navigation-progress";

export default function AccountLoading() {
  return (
    <div role="status" aria-label="Loading">
      <LoadingMark />
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-6 h-48 w-full" />
    </div>
  );
}
