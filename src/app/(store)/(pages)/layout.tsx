/** Standard contained width for store pages other than Home (URLs are unchanged by this route group). */
export default function StorePagesLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-site flex-1 px-4 py-8 sm:px-6">{children}</div>;
}
