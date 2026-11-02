"use client";

import { useState } from "react";

export interface PrefectureDelivery {
  prefecture: string;
  route?: { name: string; days: string; cutoff: string };
}

/** Prefecture → existing delivery route (sample data). No invented schedules: unmatched prefectures say so. */
export function DeliveryLookup({ prefectures }: { prefectures: PrefectureDelivery[] }) {
  const [selected, setSelected] = useState("");
  const match = prefectures.find((d) => d.prefecture === selected);
  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <label htmlFor="delivery-prefecture" className="mb-1.5 block text-sm font-medium">Your prefecture</label>
        <select
          id="delivery-prefecture"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-describedby="delivery-result"
          className="h-10 w-full rounded-ui border border-line bg-surface px-3 text-base sm:text-sm"
        >
          <option value="">Select your prefecture</option>
          {prefectures.map((d) => <option key={d.prefecture} value={d.prefecture}>{d.prefecture}</option>)}
        </select>
      </div>
      <div id="delivery-result" role="status" aria-live="polite" className="min-h-16 text-sm">
        {!match ? (
          <p className="text-muted">Choose a prefecture to see its delivery route.</p>
        ) : match.route ? (
          <div className="rounded-ui border border-line bg-surface p-3">
            <p className="font-semibold">{match.route.name}</p>
            <p className="text-muted">Delivery days: {match.route.days}</p>
            <p className="text-muted">Order by {match.route.cutoff} the day before delivery.</p>
            <p className="mt-1 text-xs text-muted">Sample route data for this demo — delivery charges are confirmed when you order.</p>
          </div>
        ) : (
          <p className="rounded-ui border border-line bg-surface p-3 text-muted">No delivery route is scheduled for {match.prefecture} yet. Please contact our team.</p>
        )}
      </div>
    </div>
  );
}
