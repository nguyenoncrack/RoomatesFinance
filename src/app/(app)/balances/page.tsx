import type { Metadata } from "next";
import { BalancesView } from "@/components/balances/balances-view";

export const metadata: Metadata = { title: "Balances" };

export default function BalancesPage() {
  return <BalancesView />;
}
