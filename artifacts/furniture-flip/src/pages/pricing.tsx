import { useGetUsage, useCreateCheckoutSession, useCreatePortalSession, useGetMe } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Zap, Settings, CreditCard } from "lucide-react";

export default function Pricing() {
  const { data: usage, isLoading: usageLoading } = useGetUsage();
  const { data: user } = useGetMe();
  
  const checkoutSession = useCreateCheckoutSession();
  const portalSession = useCreatePortalSession();

  const handleSubscribe = () => {
    checkoutSession.mutate(undefined, {
      onSuccess: (res) => {
        window.location.href = res.url;
      }
    });
  };

  const handleManageBilling = () => {
    portalSession.mutate(undefined, {
      onSuccess: (res) => {
        window.location.href = res.url;
      }
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

  const isPro = user.plan === "pro";

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="font-serif text-4xl font-bold text-foreground mb-4">Pricing that pays for itself</h1>
          <p className="text-lg text-muted-foreground">Upgrade to Pro to unlock unlimited generations and sell your flips faster.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-start">
          {/* Free Trial */}
          <div className="bg-card p-8 rounded-3xl border border-border shadow-sm opacity-80">
            <h3 className="text-2xl font-bold text-foreground mb-2">Free Trial</h3>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
            </div>
            
            <div className="bg-muted p-4 rounded-xl mb-8">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-foreground">Usage</span>
                <span className="text-muted-foreground">{usage?.trialUsed} / {usage?.trialLimit} used</span>
              </div>
              <div className="w-full bg-border h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${usage?.isTrialExpired ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${Math.min(((usage?.trialUsed || 0) / (usage?.trialLimit || 3)) * 100, 100)}%` }}
                />
              </div>
            </div>

            <ul className="space-y-4 mb-8 text-muted-foreground">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>3 AI generations</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>Background removal</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span>Ad copy generation</span>
              </li>
            </ul>
            
            <Button variant="outline" className="w-full rounded-xl h-12" disabled>
              {isPro ? "Free Plan" : "Current Plan"}
            </Button>
          </div>
          
          {/* Pro Plan */}
          <div className="bg-secondary text-secondary-foreground p-8 rounded-3xl shadow-xl relative overflow-hidden ring-2 ring-primary/20">
            <div className="absolute top-0 right-0 p-4">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3"/> PRO
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-2">Pro Flipper</h3>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$9.99</span>
              <span className="text-secondary-foreground/70">/month</span>
            </div>
            <p className="text-secondary-foreground/80 mb-8 pb-8 border-b border-secondary-foreground/20">For serious flippers who list multiple items a week.</p>
            <ul className="space-y-4 mb-8">
              {[
                "Unlimited AI generations", 
                "All premium room styles", 
                "Priority processing speed", 
                "Ad copy templates", 
                "Cancel anytime"
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
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
                {checkoutSession.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upgrade to Pro"}
              </Button>
            )}
          </div>
        </div>

        {/* Account Info (if accessed from sidebar) */}
        {isPro && (
          <div className="max-w-4xl mx-auto mt-12 bg-card border border-border p-6 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Billing Settings</h4>
                <p className="text-sm text-muted-foreground">Update payment methods, view invoices, or cancel plan.</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleManageBilling} disabled={portalSession.isPending}>
              <Settings className="w-4 h-4 mr-2" /> Manage Billing
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
