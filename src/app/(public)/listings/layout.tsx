import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Bay Area Properties",
  description:
    "Explore properties for sale and recently sold homes represented by April Zhao across the San Francisco Bay Area.",
  path: "/listings",
});

export default function ListingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
