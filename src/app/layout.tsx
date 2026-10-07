import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Instrument Serif ships a single 400 weight: never apply a bold weight to it.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vibe to UI",
  description: "Describe what you're making. Get a considered interface you can edit one section at a time.",
};

// Runs before first paint so the saved (or system) theme never flashes the wrong colors.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('vtu-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only rounded-control bg-accent-fill px-4 py-2 text-sm font-medium text-on-accent focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
        >
          Skip to canvas
        </a>
        {children}
      </body>
    </html>
  );
}
