import { AppShell } from "@/components/layout/app-shell";
import { SignalDetail } from "@/components/signals/signal-detail";

export default async function SignalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><SignalDetail id={id} /></AppShell>;
}
