import { redirectSignedInAway } from "@/lib/auth-redirect";

export default async function LoginGate({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectSignedInAway();
  return <>{children}</>;
}
