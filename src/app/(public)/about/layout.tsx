import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "About April Zhao",
  description:
    "Meet April Zhao, a Bay Area real estate agent providing thoughtful, local guidance for home buyers and sellers.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
