import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fable | Find your next read",
  description: "A quieter kind of endless discovery. Read public-domain literature, beautifully.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
