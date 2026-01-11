import Script from "next/script";

// Replace with your actual GA4 Measurement ID
// You can get this from Google Analytics > Admin > Data Streams > Web
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  // Don't render if no measurement ID is configured
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      {/* Google Analytics Script */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_title: document.title,
            page_location: window.location.href,
          });
        `}
      </Script>
    </>
  );
}

// Event tracking helper - can be imported and used throughout the app
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, string | number | boolean>
) {
  if (typeof window !== "undefined" && GA_MEASUREMENT_ID) {
    // @ts-expect-error gtag is added by the script
    window.gtag?.("event", eventName, eventParams);
  }
}

// Common real estate events
export const analyticsEvents = {
  // Lead generation events
  contactFormSubmit: () =>
    trackEvent("generate_lead", {
      event_category: "Contact",
      event_label: "Contact Form Submission",
    }),

  newsletterSignup: () =>
    trackEvent("sign_up", {
      event_category: "Newsletter",
      event_label: "Newsletter Subscription",
    }),

  // Property interaction events
  viewListing: (listingId: string, listingAddress: string) =>
    trackEvent("view_item", {
      event_category: "Listing",
      event_label: listingAddress,
      item_id: listingId,
    }),

  // Call-to-action events
  clickPhone: () =>
    trackEvent("click", {
      event_category: "Contact",
      event_label: "Phone Click",
    }),

  clickEmail: () =>
    trackEvent("click", {
      event_category: "Contact",
      event_label: "Email Click",
    }),

  // Social media clicks
  clickSocial: (platform: string) =>
    trackEvent("click", {
      event_category: "Social",
      event_label: platform,
    }),
};
