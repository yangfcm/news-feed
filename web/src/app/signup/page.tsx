import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "News Feed · Create an account" };

export default function Page() {
  return <SignUpForm />;
}
