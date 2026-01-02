/**
 * New SFTP connection page.
 * Form for creating a new connection.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConnectionForm } from "@/components/sftp/connection-form";

export default async function NewConnectionPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <ConnectionForm mode="create" />
    </div>
  );
}
