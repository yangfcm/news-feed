import type { Metadata } from "next";
import { AccountPlaceholder } from "@/components/auth/account-placeholder";

export const metadata: Metadata = { title: "News Feed · Your account" };

export default function Page() {
  return <AccountPlaceholder />;
}
