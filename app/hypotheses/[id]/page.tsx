import { Hypotheses } from "@/components/hypotheses/hypotheses";
import { AppShell } from "@/components/layout/app-shell";

export default async function HypothesisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><Hypotheses mode="detail" id={id} /></AppShell>;
}
