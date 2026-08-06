import { redirectSignedInAway } from "@/lib/auth-redirect";

export default async function SignupGate({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectSignedInAway();
  return <>{children}</>;
}
