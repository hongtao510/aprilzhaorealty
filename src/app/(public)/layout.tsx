import { Header, Footer, ScrollToTop } from "@/components/ClientLayout";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 pt-20">{children}</main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
