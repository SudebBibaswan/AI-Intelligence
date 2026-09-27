import { AppShell } from "@/components/layout/app-shell";
import { Patterns } from "@/components/patterns/patterns";
export default async function PatternDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AppShell><Patterns id={id} /></AppShell>; }
