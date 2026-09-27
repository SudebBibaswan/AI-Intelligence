import { AppShell } from "@/components/layout/app-shell";
import { ResearchRuns } from "@/components/research/research-runs";

export default async function ResearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><ResearchRuns detailId={id} /></AppShell>;
}
