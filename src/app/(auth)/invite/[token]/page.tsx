import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getInvitationPreviewForToken } from "@/lib/user-invitations/invite-preview";
import { AcceptInviteForm } from "./accept-invite-form";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Accept invitation",
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const preview = await getInvitationPreviewForToken(decoded);
  if (!preview) {
    notFound();
  }

  return <AcceptInviteForm token={decoded} maskedEmail={preview.maskedEmail} />;
}
