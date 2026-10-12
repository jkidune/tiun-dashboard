import Link from "next/link";
import { can } from "@/lib/auth";
import { getContext } from "@/lib/context";
import { readCheckout } from "@/lib/settings";
import { PageTopbar } from "@/components/shell/PageTopbar";
import { AppearanceForm } from "./AppearanceForm";

export const metadata = { title: "Checkout appearance" };

export default async function CheckoutAppearancePage() {
  const { workspace, member } = await getContext();
  return (
    <>
      <PageTopbar title="Checkout" showPeriod={false}>
        <Link href="/setup/checkout" className="btn">Plans & coupons</Link>
      </PageTopbar>
      <div className="content">
        <AppearanceForm initial={readCheckout(workspace.checkoutSettings)} workspace={workspace.name} canEdit={can(member.role, "checkout")} />
      </div>
    </>
  );
}
