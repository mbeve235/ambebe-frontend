import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { BrandingProvider } from "@/components/branding-provider";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading"
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "AMBEBE | AMBEBE CORP",
  description: "AMBEBE e uma marca da AMBEBE CORP."
};

const themeScript = `
(() => {
  const storageKey = "ambebe_theme";
  const stored = window.localStorage.getItem(storageKey);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className={`${headingFont.variable} ${bodyFont.variable} font-body text-text`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <BrandingProvider>{children}</BrandingProvider>
      </body>
    </html>
  );
}

