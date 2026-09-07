import type { Metadata } from "next";

export const SITE_ORIGIN = "https://aprilzhaohome.com";
export const DEFAULT_SHARE_IMAGE = "/images/neighborhoods/belmont.jpg";

export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_SHARE_IMAGE,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const canonical = new URL(path, SITE_ORIGIN).toString();
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "April Zhao Realty",
      title: `${title} | April Zhao Realty`,
      description,
      url: canonical,
      images: [{ url: image, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | April Zhao Realty`,
      description,
      images: [image],
    },
  };
}
