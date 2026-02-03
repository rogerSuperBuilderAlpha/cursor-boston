import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a Cursor Boston account to join the AI development community in Boston.",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
