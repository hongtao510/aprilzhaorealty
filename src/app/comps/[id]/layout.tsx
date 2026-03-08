export default function CompsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto p-8">{children}</div>
    </div>
  );
}
