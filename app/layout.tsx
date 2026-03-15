import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCrab",
  description: "A simple Codex-powered assistant for everyday users.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {process.env.NODE_ENV === "development" ? (
          <Script id="extension-error-guard" strategy="beforeInteractive">
            {`
              (function () {
                function isExtensionOriginError(payload) {
                  if (!payload) return false;
                  var text = "";
                  if (typeof payload === "string") {
                    text = payload;
                  } else {
                    text = [
                      payload.message,
                      payload.reason && payload.reason.message,
                      payload.error && payload.error.message,
                      payload.stack,
                      payload.reason && payload.reason.stack,
                      payload.error && payload.error.stack
                    ].filter(Boolean).join("\\n");
                  }
                  return text.includes("chrome-extension://") && text.includes("Origin not allowed");
                }

                window.addEventListener(
                  "error",
                  function (event) {
                    if (!isExtensionOriginError(event)) return;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                  },
                  true
                );

                window.addEventListener(
                  "unhandledrejection",
                  function (event) {
                    if (!isExtensionOriginError(event)) return;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                  },
                  true
                );
              })();
            `}
          </Script>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
