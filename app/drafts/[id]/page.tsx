// Review screen for one draft (server part: loads the data).
import { notFound } from "next/navigation";
import { ReviewScreen } from "@/components/review/review-screen";
import { getDb } from "@/lib/db";
import { getDraftDetail } from "@/lib/services/drafts";
import { ServiceError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  try {
    detail = await getDraftDetail(await getDb(), id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
  return <ReviewScreen detail={detail} />;
}
