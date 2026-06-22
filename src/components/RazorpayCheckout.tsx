import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface RazorpayCheckoutProps {
  amount: number;
  onSuccess: () => void;
}

/**
* Handles the Razorpay subscription checkout flow for a logged-in user, including order creation, payment initiation, and payment verification.
* @example
* handlePayment()
* "Payment successful!"
* @param {number} amount - The subscription amount to charge in INR.
* @param {Function} onSuccess - Callback invoked after successful payment verification.
* @returns {JSX.Element} A checkout UI with a subscribe button and optional status message.
**/
export const RazorpayCheckout: React.FC<RazorpayCheckoutProps> = ({
  amount,
  onSuccess,
}) => {
  const [message, setMessage] = useState<string | null>(null);

  /**
  * Initiates a Razorpay subscription payment flow for the signed-in user, creates an order, opens the checkout modal, and verifies the payment on success.
  * @example
  * sync()
  * undefined
  * @param {void} - This function does not accept any parameters.
  * @returns {Promise<void>} A promise that resolves after the payment flow is started or an error is handled.
  **/
  const handlePayment = async () => {
    setMessage(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage("Please login to subscribe");
        return;
      }

      // Dynamically load Razorpay checkout
      if (!(window as any).Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      // 1. Create order
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const order = await response.json();

      // 2. Open Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "Your App Name",
        description: "Subscription",
        order_id: order.id,
        handler: async (response: any) => {
          // 3. Verify payment
          const verifyResponse = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: user.id,
            }),
          });

          if (verifyResponse.ok) {
            setMessage("Payment successful!");
            onSuccess();
          } else {
            setMessage("Payment verification failed");
          }
        },
        prefill: {
          email: user.email,
        },
      };

      const razor = new (window as any).Razorpay(options);
      razor.open();
    } catch (error) {
      console.error("Payment error:", error);
      setMessage("Payment failed");
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handlePayment}
        className="bg-cmd-cyan text-white px-4 py-2 rounded-lg"
      >
        Subscribe for ₹{amount}
      </button>
      {message && <p className="text-xs font-bold text-red-500">{message}</p>}
    </div>
  );
};
