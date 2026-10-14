import { AppShell } from "@/components/layout/app-shell";
import { AppDataProvider } from "@/components/providers/app-data-provider";
import { DialogsProvider } from "@/components/providers/dialogs-provider";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppDataProvider>
      <DialogsProvider>
        <AppShell>{children}</AppShell>
      </DialogsProvider>
    </AppDataProvider>
  );
}
