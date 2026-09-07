import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata({
  title: "Contact April Zhao",
  description:
    "Contact April Zhao for personalized guidance buying or selling a home in the San Francisco Bay Area.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
