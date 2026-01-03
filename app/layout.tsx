import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Providers from "@/components/Providers";

export const dynamic = 'force-dynamic';
import AISupportWidget from "@/components/AISupportWidget";
import ProgressBar from "@/components/ProgressBar";
import NotificationContainer from "@/components/NotificationContainer";
import NotificationListener from "@/components/NotificationListener";

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
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        <Providers>
          {children}
          <AISupportWidget />
          <NotificationContainer />
          <NotificationListener />
        </Providers>
      </body>
    </html>
  );
}

