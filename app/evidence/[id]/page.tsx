import { EvidenceDetail } from "@/components/evidence/evidence-detail";
import { AppShell } from "@/components/layout/app-shell";

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><EvidenceDetail id={id} /></AppShell>;
}
