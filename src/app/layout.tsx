import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Instrument_Serif, Patrick_Hand } from "next/font/google";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

/**
 * SVG filters referenced from CSS (`filter: url(#pencil)`): low-frequency noise displaces an outline so
 * straight edges wobble like a hand-drawn pencil line.
 */
function PencilFilters() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <filter id="pencil" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="pencil-strong" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="11" result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="4.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Condensed editorial serif for headings and big numbers.
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Handwriting for names, amounts in lists and small captions.
const patrickHand = Patrick_Hand({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: "400",
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
  themeColor: "#f0eee7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} ${instrumentSerif.variable} ${patrickHand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <PencilFilters />
        <MotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </MotionProvider>
        <Toaster theme="light" position="top-center" richColors={false} />
      </body>
    </html>
  );
}
