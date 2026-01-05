/**
 * Edit SFTP connection page.
 * Form for updating an existing connection.
 */

import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSftpConnection } from "@/lib/sftp-actions";
import { ConnectionForm } from "@/components/sftp/connection-form";

interface EditConnectionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditConnectionPage({
  params,
}: EditConnectionPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const { id } = await params;
  const result = await getSftpConnection(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <ConnectionForm
        mode="edit"
        initialData={{
          id: result.data.id,
          name: result.data.name,
          host: result.data.host,
          port: result.data.port,
          username: result.data.username,
          authType: result.data.authType as "PASSWORD" | "PRIVATE_KEY",
          basePath: result.data.basePath,
        }}
      />
    </div>
  );
}
