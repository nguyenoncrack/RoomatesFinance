import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Tight neo-grotesk for headings and big numbers: light weights, negative tracking.
const interTight = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Roommate AI — split expenses, settle up", template: "%s · Roommate AI" },
  description: "Track shared expenses with your roommates, split costs any way you like, and see exactly who pays whom.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${geistMono.variable} ${interTight.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <MotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster theme="dark" position="top-center" richColors={false} />
      </body>
    </html>
  );
}
