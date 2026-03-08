import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createPaymentIntent } from "../api";
import { PRICING_PLANS } from "../constants/pricing";

const stripePk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripePk ? loadStripe(stripePk) : null;

const cardElementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#1f2937",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: {
      color: "#dc2626",
    },
  },
};

function PaymentForm({ clientSecret, planName, planPrice, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setSubmitting(true);
    onError(null);
    try {
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (error) {
        onError(error.message || "Payment failed");
        return;
      }
      onSuccess();
    } catch (err) {
      onError(err.message || "Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">Card details</label>
        <CardElement options={cardElementOptions} className="p-3" />
      </div>
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 py-3 px-4 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-70"
      >
        {submitting ? "Processing…" : `Pay $${planPrice}`}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan") || "";
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payError, setPayError] = useState(null);

  const plan = PRICING_PLANS.find((p) => p.id === planId);

  useEffect(() => {
    if (!planId || !plan) {
      navigate("/#pricing", { replace: true });
      return;
    }
    if (!stripePromise) {
      setError("Payment form is not configured.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    createPaymentIntent(planId)
      .then((secret) => {
        if (!cancelled) {
          setClientSecret(secret);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load payment form");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [planId, plan, navigate]);

  const handlePaymentSuccess = () => {
    navigate("/?success=payment", { replace: true });
  };

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">Complete payment</h1>
          <p className="mt-2 text-gray-600">
            {plan.name} — ${plan.price}
          </p>

          {loading && (
            <div className="mt-6 text-center text-gray-500">Loading payment form…</div>
          )}

          {error && (
            <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          {clientSecret && stripePromise && !loading && (
            <div className="mt-6">
              {payError && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                  {payError}
                </div>
              )}
              <Elements stripe={stripePromise}>
                <PaymentForm
                  clientSecret={clientSecret}
                  planName={plan.name}
                  planPrice={plan.price}
                  onSuccess={handlePaymentSuccess}
                  onError={setPayError}
                />
              </Elements>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/#pricing")}
            className="mt-6 w-full rounded-full border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to pricing
          </button>
        </div>
      </div>
    </div>
  );
}
