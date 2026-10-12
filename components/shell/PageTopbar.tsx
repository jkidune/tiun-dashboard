import { cache } from "react";
import { FlaskConical } from "lucide-react";
import { db } from "@/lib/db";
import { getContext } from "@/lib/context";
import { Topbar } from "./Topbar";

const alertCount = cache(async (workspaceId: string, mode: "LIVE" | "TEST") => {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [failed, hooks] = await Promise.all([
    db.transaction.count({ where: { workspaceId, mode, status: "FAILED", createdAt: { gte: since } } }),
    db.webhook.count({ where: { workspaceId, status: "FAILING" } }),
  ]);
  return failed + hooks;
});

/** Page title bar: global Live/Sandbox + month controls, plus the page's own actions. */
export async function PageTopbar({ title, showPeriod = true, children }: { title: string; showPeriod?: boolean; children?: React.ReactNode }) {
  const ctx = await getContext();
  const alerts = await alertCount(ctx.workspace.id, ctx.mode);
  return (
    <>
      <Topbar
        title={title}
        mode={ctx.mode}
        month={ctx.month.key}
        months={ctx.monthOptions.map((m) => ({ key: m.key, label: m.label }))}
        alerts={alerts}
        showPeriod={showPeriod}
      >
        {children}
      </Topbar>
      {ctx.mode === "TEST" && (
        <div className="sandbox-banner" role="status">
          <FlaskConical size={15} /> You’re viewing Sandbox data. Nothing here touches live customers or money.
        </div>
      )}
    </>
  );
}
