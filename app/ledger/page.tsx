// Fact Ledger: the versioned store of approved facts every claim is checked against.
import { PageHeader } from "@/components/form-fields";
import { LedgerClient } from "@/components/ledger/ledger-client";
import { getDb } from "@/lib/db";
import { listFacts, maskConfidential } from "@/lib/services/ledger";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const [user, facts] = await Promise.all([getCurrentUser(), listFacts(await getDb())]);
  const isAdmin = user.role === "admin";
  // Confidential values never reach a non-admin browser at all.
  const safeFacts = isAdmin ? facts : maskConfidential(facts);
  return (
    <div>
      <PageHeader
        title="Fact Ledger"
        description={
          <>
            Approved facts with their source, owner and effective date. Every claim in a draft is labelled Supported, Outdated, Conflicting or Unsupported against this ledger. Rule: no source, no claim.
            {!isAdmin && " Only the brand owner (Meera) can add facts or versions."}
          </>
        }
      />
      <LedgerClient facts={safeFacts} isAdmin={isAdmin} ownerName={user.name} />
    </div>
  );
}
