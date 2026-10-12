import Link from "next/link";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { readAuth } from "@/lib/settings";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { ProvidersForm } from "./ProvidersForm";

export const metadata = { title: "Authentication" };

export default async function AuthenticationPage() {
  const { workspace, member } = await getContext();
  return (
    <>
      <PageTopbar title="Authentication" showPeriod={false}>
        <Link href="/app/setup/authentication/policies" className="btn">Policies</Link>
      </PageTopbar>
      <div className="content">
        <ProvidersForm initial={readAuth(workspace.authSettings)} workspace={workspace.name} canEdit={can(member.role, "developer")} />
      </div>
    </>
  );
}
