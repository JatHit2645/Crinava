import React, { useEffect } from "react";
import { useUserSubscription } from "../hooks/useUserSubscription";

interface AdComponentProps {
  slot: string;
  className?: string;
}

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
