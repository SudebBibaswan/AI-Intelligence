import { CompanyDetail } from "@/components/companies/company-detail";
import { AppShell } from "@/components/layout/app-shell";

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><CompanyDetail id={id} /></AppShell>;
}
