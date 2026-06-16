import React from 'react';
import { supabase } from '../lib/supabaseClient';

interface RazorpayCheckoutProps {
  amount: number;
  onSuccess: () => void;
}

export const RazorpayCheckout: React.FC<RazorpayCheckoutProps> = ({ amount, onSuccess }) => {
  const handlePayment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please login to subscribe');
        return;
      }

      // 1. Create order
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          const verifyResponse = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: user.id
            }),
          });
          
          if (verifyResponse.ok) {
            alert('Payment successful!');
            onSuccess();
          } else {
            alert('Payment verification failed');
          }
        },
        prefill: {
          email: user.email,
        },
      };

      const razor = new (window as any).Razorpay(options);
      razor.open();
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed');
    }
  };

  return (
    <button onClick={handlePayment} className="bg-cmd-cyan text-white px-4 py-2 rounded-lg">
      Subscribe for ₹{amount}
    </button>
  );
};
