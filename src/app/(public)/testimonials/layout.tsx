import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Client Testimonials",
  description:
    "Read what Bay Area buyers and sellers say about working with April Zhao.",
  path: "/testimonials",
});

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
