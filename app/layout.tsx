import "../styles/globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import AppLifecycleMetrics from "@/components/AppLifecycleMetrics";
import MarketingConsent from "@/components/MarketingConsent";

const siteUrl = "https://www.mercau.co";

export const metadata: Metadata = {
  applicationName: "Mercáu",
  title: "Mercáu | Directorio Digital del Bajo Cauca",
  description:
    "Mercáu es el directorio digital del Bajo Cauca para encontrar negocios locales, contactar por WhatsApp e inscribir comercios.",
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mercáu",
    startupImage: [
      { url: "/splash/iphone-1320x2868.png", media: "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1242x2688.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1206x2622.png", media: "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/iphone-828x1792.png", media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" },
      { url: "/splash/iphone-750x1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" }
    ]
  },
  icons: {
    icon: [{ url: "/logo-mercau.png", type: "image/png", sizes: "1024x1024" }],
    shortcut: "/logo-mercau.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Mercáu",
    title: "Mercáu | Directorio Digital del Bajo Cauca",
    description:
      "Encuentra negocios del Bajo Cauca, contacta por WhatsApp o inscribe tu negocio en el directorio digital.",
    url: "/",
    images: [
      {
        url: "/og-mercau.jpg",
        width: 1200,
        height: 630,
        alt: "Mercáu, Directorio Digital del Bajo Cauca"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Mercáu | Directorio Digital del Bajo Cauca",
    description:
      "Encuentra negocios del Bajo Cauca, contacta por WhatsApp o inscribe tu negocio en el directorio digital.",
    images: ["/og-mercau.jpg"]
  }
};

export const viewport: Viewport = {
  themeColor: "#d71f16"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <Script id="mercau-install-capture" strategy="beforeInteractive">{`
          window.__mercauInstallPrompt = null;
          window.addEventListener('beforeinstallprompt', function (event) {
            event.preventDefault();
            window.__mercauInstallPrompt = event;
            window.dispatchEvent(new Event('mercau-install-ready'));
          });
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/mercau-sw.js', { scope: '/' }).catch(function () {});
          }
        `}</Script>
        <AppLifecycleMetrics />
        <MarketingConsent />
        <main>{children}</main>
      </body>
    </html>
  );
}
