"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

import { trackPageView } from "@/lib/meta-pixel";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * The base snippet fires PageView once, on hard document load. App Router navigations
 * never reload the document, so without this every page after the entry page is invisible
 * to Meta — including /signup, whenever the visitor lands on the homepage first.
 *
 * Keyed on the resolved URL rather than a run counter so React StrictMode's double-invoke
 * in development cannot produce a phantom second PageView.
 */
function PageViewOnNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    if (lastTrackedUrl.current === null) {
      // First render: the base snippet already counted this URL.
      lastTrackedUrl.current = url;
      return;
    }
    if (lastTrackedUrl.current === url) return;

    lastTrackedUrl.current = url;
    trackPageView();
  }, [pathname, searchParams]);

  return null;
}

export function MetaPixel() {
  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');
fbq('track','PageView');`}
      </Script>
      <Suspense fallback={null}>
        <PageViewOnNavigation />
      </Suspense>
    </>
  );
}
