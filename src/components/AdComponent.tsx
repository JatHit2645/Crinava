import React, { useEffect } from "react";
import { useUserSubscription } from "../hooks/useUserSubscription";

interface AdComponentProps {
  slot: string;
  className?: string;
}

/**
 * Renders a Google AdSense ad unit for unsubscribed users and loads the AdSense script when needed.
 * @example
 * AdComponent({ slot: "1234567890", className: "ad-wrapper" })
 * null
 * @param {string} slot - The AdSense ad slot ID to display.
 * @param {string} className - Optional CSS class name applied to the ad container.
 * @returns {JSX.Element | null} The ad container element, or null when the user is loading or subscribed.
 **/
export const AdComponent: React.FC<AdComponentProps> = ({
  slot,
  className,
}) => {
  const { isSubscribed, isLoading } = useUserSubscription();

  useEffect(() => {
    if (isLoading || isSubscribed) return;

    // Load AdSense script if not already loaded
    if (!document.getElementById("adsense-script")) {
      const script = document.createElement("script");
      script.id = "adsense-script";
      script.async = true;
      script.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5085085983757681";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    // Push ad
    try {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, [isSubscribed, isLoading]);

  if (isLoading || isSubscribed) {
    return null;
  }

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-5085085983757681"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};
