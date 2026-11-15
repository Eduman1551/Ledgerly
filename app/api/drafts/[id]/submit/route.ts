// POST /api/drafts/:id/submit → send the draft to the reviewer.
import { route, type IdParams } from "@/lib/api";
import { getDb } from "@/lib/db";
import { submitDraft } from "@/lib/services/review";

export const POST = route(async (_request, { params }: IdParams) => submitDraft(await getDb(), (await params).id));
