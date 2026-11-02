import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavigationProgressProvider } from "@/components/navigation-progress";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { themeScript } from "@/lib/theme";
import { themeColorScript } from "@/lib/theme-color";
import { viewScript } from "@/lib/view";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "News Feed",
  description: "Daily digest of podcasts, YouTube channels and blogs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // themeScript, themeColorScript and viewScript set the theme class, theme color and view attributes on <html> before hydration.
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeColorScript }} />
        <script dangerouslySetInnerHTML={{ __html: viewScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <NavigationProgressProvider>
            <TooltipProvider>
              <SiteHeader />
              {children}
            </TooltipProvider>
          </NavigationProgressProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
