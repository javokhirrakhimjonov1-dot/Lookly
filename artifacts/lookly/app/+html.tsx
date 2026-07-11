import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="color-scheme" content="light" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
              }
              body {
                overflow: hidden;
                background-color: #E8E4DF;
                -webkit-font-smoothing: antialiased;
                display: flex;
                justify-content: center;
              }
              #root {
                display: flex;
                flex-direction: column;
                flex: 1;
                width: 100%;
                max-width: 480px;
                min-height: 100vh;
                min-height: 100dvh;
                background-color: #F9F8F6;
                box-shadow: 0 0 40px rgba(28, 21, 18, 0.08);
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
