import "./globals.css";

export const metadata = {
  title: "Nova Carriers — Marine Insurance Claims Co-Pilot",
  description: "Claims intake, tracking, reminders, and drafts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">
        <div className="min-h-screen">
          {/* Top Nav */}
          <header className="bg-white border-b">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold">
                  NC
                </div>
                <div>
                  <div className="font-semibold leading-tight">Nova Carriers</div>
                  <div className="text-xs text-gray-500 leading-tight">
                    Marine Insurance Claims Co-Pilot
                  </div>
                </div>
              </div>

              <nav className="flex items-center gap-4 text-sm">
                <a className="text-blue-700 hover:underline" href="/">
                  New Claim
                </a>
                <a className="text-blue-700 hover:underline" href="/claims">
                  Claims
                </a>
                <a className="text-blue-700 hover:underline" href="/finance">
                  $ Dashboard
                </a>
                <a className="text-blue-700 hover:underline" href="/reminders">
                  Reminders
                </a>
              </nav>
            </div>
          </header>

          {/* Page */}
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

          <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-gray-500">
            MVP: local file persistence now. Vercel DB next.
          </footer>
        </div>
      </body>
    </html>
  );
}
