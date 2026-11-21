import type { Metadata } from "next";
import { VerifyEmail } from "@/components/auth/verify-email";

export const metadata: Metadata = { title: "News Feed · Verify your email" };

export default function Page() {
  return <VerifyEmail />;
}
