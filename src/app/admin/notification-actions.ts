"use server";

/*
 * Admin notification read marks. DEMO: kept in server memory, shared by everyone.
 * TODO(auth): the backend must authenticate the admin and store read marks per staff user.
 */
import { revalidatePath } from "next/cache";
import { repositories } from "@/lib/data";

export async function markAdminNotificationReadAction(id: unknown): Promise<void> {
  if (typeof id !== "string") return;
  await repositories.adminNotifications.markRead(id.slice(0, 200));
  revalidatePath("/admin", "layout");
}

export async function markAllAdminNotificationsReadAction(): Promise<void> {
  await repositories.adminNotifications.markAllRead();
  revalidatePath("/admin", "layout");
}
