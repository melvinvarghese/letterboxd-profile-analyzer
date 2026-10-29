import "./globals.css";
export const metadata = {
  title: "Frame by Frame · Letterboxd Profile Analyzer",
  description:
    "Explore your film journal: private Letterboxd export analytics, diary calendars, rating patterns and watchlist discoveries.",
  authors: [{ name: "Melvin Varghese" }],
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111923",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
