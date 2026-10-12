import Link from "next/link";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { readAuth } from "@/lib/settings";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { CardHead } from "@/components/ui/bits";
import { DirtyForm } from "@/components/ui/client";
import { saveAuthPolicies } from "@/app/actions/setup";

export const metadata = { title: "Authentication policies" };

export default async function PoliciesPage() {
  const { workspace, member } = await getContext();
  const s = readAuth(workspace.authSettings);
  const disabled = !can(member.role, "developer");

  return (
    <>
      <PageTopbar title="Authentication" showPeriod={false}>
        <Link href="/setup/authentication" className="btn">Providers</Link>
      </PageTopbar>
      <div className="content">
        <DirtyForm action={saveAuthPolicies}>
          <section className="card">
            <CardHead title="Sessions and passwords" sub="Applies to every customer of this workspace" divider />
            <div className="card-body">
              <div className="setting-row">
                <div className="text">
                  <div className="title">Session length</div>
                  <div className="desc">Customers are signed out after this many days without activity.</div>
                </div>
                <input name="sessionDays" type="number" min={1} max={365} defaultValue={s.sessionDays} className="input" style={{ width: 110 }} aria-label="Session length in days" disabled={disabled} />
              </div>
              <div className="setting-row">
                <div className="text">
                  <div className="title">Minimum password length</div>
                  <div className="desc">NIST recommends at least 8 characters; 10–12 is a good default.</div>
                </div>
                <input name="minPasswordLength" type="number" min={8} max={64} defaultValue={s.minPasswordLength} className="input" style={{ width: 110 }} aria-label="Minimum password length" disabled={disabled} />
              </div>
              <div className="setting-row">
                <div className="text">
                  <div className="title">Require a symbol</div>
                  <div className="desc">Passwords must include at least one non-letter character.</div>
                </div>
                <input name="requireSymbols" type="checkbox" className="toggle" defaultChecked={s.requireSymbols} aria-label="Require a symbol" disabled={disabled} />
              </div>
            </div>
          </section>

          <section className="card">
            <CardHead title="Security" divider />
            <div className="card-body">
              <div className="setting-row">
                <div className="text">
                  <div className="title">Two-factor authentication</div>
                  <div className="desc">Off, optional for customers, or required at every sign-in.</div>
                </div>
                <select name="mfa" defaultValue={s.mfa} className="select" style={{ width: 150 }} aria-label="Two-factor authentication" disabled={disabled}>
                  <option value="off">Off</option>
                  <option value="optional">Optional</option>
                  <option value="required">Required</option>
                </select>
              </div>
              <div className="setting-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <div className="text">
                  <div className="title">Allowed email domains</div>
                  <div className="desc">Leave empty to allow anyone. Separate domains with commas.</div>
                </div>
                <input name="allowedDomains" defaultValue={s.allowedDomains} className="input" style={{ width: 280, maxWidth: "100%" }} placeholder="akoya.ai, dvv-international.de" aria-label="Allowed email domains" disabled={disabled} />
              </div>
              <div className="setting-row">
                <div className="text">
                  <div className="title">Bot protection</div>
                  <div className="desc">Challenge suspicious sign-up attempts.</div>
                </div>
                <input name="botProtection" type="checkbox" className="toggle" defaultChecked={s.botProtection} aria-label="Bot protection" disabled={disabled} />
              </div>
            </div>
          </section>
        </DirtyForm>
      </div>
    </>
  );
}
