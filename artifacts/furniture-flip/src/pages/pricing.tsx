import { Link } from "wouter";
import { useCreateCheckoutSession, useCreatePortalSession, useGetMe, useGetUsage } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

export default function Pricing() {
  const { data: usage, isLoading: usageLoading } = useGetUsage();
  const { data: user } = useGetMe();
  const checkoutSession = useCreateCheckoutSession();
  const portalSession = useCreatePortalSession();

  const isPro = user?.plan === "pro";
  const basicUsed = usage?.trialUsed ?? user?.trialUsed ?? 0;
  const basicLimit = usage?.trialLimit ?? user?.trialLimit ?? 3;
  const isBasicLocked = Boolean(usage?.isTrialExpired);

  const handleSubscribe = () => {
    checkoutSession.mutate(undefined, {
      onSuccess: (res) => {
        window.location.href = res.url;
      },
    });
  };

  const handleManageBilling = () => {
    portalSession.mutate(undefined, {
      onSuccess: (res) => {
        window.location.href = res.url;
      },
    });
  };

  if (usageLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Choose how much access you want</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Two plans, one clear upgrade path
          </h1>
          <p className="text-lg text-muted-foreground">
            Basic lets you click around and try the product with limited functionality.
            Pro unlocks the full studio and lets each user bring their own API keys and model preferences.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-start">
          <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-foreground">Basic</h3>
              <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-muted text-muted-foreground">
                Limited Access
              </span>
            </div>

            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
            </div>

            <p className="text-muted-foreground mb-8 pb-8 border-b border-border">
              Sign up now, no credit card required. Try the app with a capped set of actions and explore the workflow before upgrading.
            </p>

            <div className="bg-muted p-4 rounded-xl mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-foreground">Basic usage</span>
                <span className="text-muted-foreground">{basicUsed} / {basicLimit} edits used</span>
              </div>
              <div className="w-full bg-border h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isBasicLocked ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min((basicUsed / basicLimit) * 100, 100)}%` }}
                />
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              {[
                "Browse the app and try core screens",
                "Limited edits and generation credits",
                "No credit card required",
                "Upgrade anytime when you're ready",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link href="/register">
              <Button variant="outline" className="w-full rounded-xl h-12 border-primary text-primary hover:bg-primary/5">
                Start Basic Access
              </Button>
            </Link>
          </div>

          <div className="bg-secondary text-secondary-foreground p-8 rounded-3xl shadow-xl relative overflow-hidden ring-2 ring-primary/20">
            <div className="absolute top-0 right-0 p-4">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Popular
              </span>
            </div>

            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$9.99</span>
              <span className="text-secondary-foreground/70">/month</span>
            </div>

            <p className="text-secondary-foreground/80 mb-8 pb-8 border-b border-secondary-foreground/20">
              Full access to the studio, plus account-level API key controls and model defaults.
            </p>

            <ul className="space-y-4 mb-8">
              {[
                "Unlimited AI generations",
                "All premium room styles",
                "Bring your own API keys",
                "Choose your default image, text, or multimodal model",
                "Priority processing",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {isPro ? (
              <Button
                onClick={handleManageBilling}
                disabled={portalSession.isPending}
                variant="outline"
                className="w-full rounded-xl h-12 border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/10"
              >
                {portalSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Manage Subscription"}
              </Button>
            ) : (
              <Button
                onClick={handleSubscribe}
                disabled={checkoutSession.isPending}
                className="w-full rounded-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                {checkoutSession.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Upgrade to Pro <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
