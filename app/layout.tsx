import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { NodesProvider } from "@/lib/context/NodesContext";
import { UserRegionProvider } from "@/lib/contexts/UserRegionContext";
import AISupportWidget from "@/components/AISupportWidget";
import ProgressBar from "@/components/ProgressBar";

export const metadata: Metadata = {
  title: "pGlobe",
  description: "Analytics platform for Xandeum Provider Nodes (pNodes)",
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                    const stored = localStorage.getItem('darkMode');
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    const shouldBeDark = stored ? stored === 'true' : prefersDark;
                    if (shouldBeDark) {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.add('light');
                    }
                  }
                } catch (e) {
                  // Silently fail during SSR
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        <NodesProvider>
          <UserRegionProvider>
            {children}
            <AISupportWidget />
          </UserRegionProvider>
        </NodesProvider>
      </body>
    </html>
  );
}

