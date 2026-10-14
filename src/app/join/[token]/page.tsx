import type { Metadata } from "next";
import { JoinView } from "@/components/auth/join-view";

export const metadata: Metadata = { title: "Join household" };

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  return <JoinView token={token} />;
}
