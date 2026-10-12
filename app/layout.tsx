import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./app.css";
import "./ui.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: { default: "tiun.", template: "%s · tiun." },
  description: "Subscription and usage billing console",
};

// Applies the saved Light/Dark/System choice before paint (Settings → Appearance).
const themeScript = `try{var t=localStorage.getItem("tiun-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Extensions such as Grammarly add attributes to <body>; don't treat that as a mismatch. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
