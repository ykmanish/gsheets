import "./globals.css";

export const metadata = {
  title: "UIPL Docs",
  description: "UIPL Docs for efficient operations and document intelligence.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="newq"
    >
      <body className="min-h-full newq flex flex-col">{children}</body>
    </html>
  );
}
