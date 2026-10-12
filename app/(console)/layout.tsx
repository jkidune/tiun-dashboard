import { Shell } from "@/components/shell/Shell";
import { db } from "@/lib/db";
import { getContext } from "@/lib/context";
import { logout } from "@/app/actions/session";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { member, workspace, mode } = await getContext();
  const week = new Date(Date.now() - 7 * 86_400_000);
  const [failed, failingHooks, invites] = await Promise.all([
    db.transaction.count({ where: { workspaceId: workspace.id, mode, status: "FAILED", createdAt: { gte: week } } }),
    db.webhook.count({ where: { workspaceId: workspace.id, status: "FAILING" } }),
    db.invite.count({ where: { workspaceId: workspace.id, expiresAt: { gt: new Date() } } }),
  ]);
  return (
    <div className="page">
      <Shell
        me={{ name: member.name, email: member.email, role: member.role, avatarUrl: member.avatarUrl }}
        workspace={workspace.name}
        counts={{ transactions: failed, integration: failingHooks, team: invites }}
        logout={logout}
      >
        {children}
      </Shell>
    </div>
  );
}
