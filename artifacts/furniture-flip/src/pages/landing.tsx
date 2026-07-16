import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, Camera, Eraser, PenTool, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary selection:text-primary-foreground">
      {/* Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <span className="font-serif font-bold text-xl text-foreground tracking-tight">FurniFlip</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Log in</Link>
          <Link href="/register">
            <Button className="rounded-full shadow-sm">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-6 py-24 md:py-32 flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>AI Photo Studio for Furniture Flippers</span>
          </div>
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground leading-[1.1] mb-6 tracking-tight">
            Turn raw flips into <br className="hidden md:block" />
            <span className="italic text-primary">polished listings.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            Stop losing money to bad lighting and messy backgrounds. Remove backgrounds, stage your pieces in beautiful rooms, and generate high-converting Facebook Marketplace copy in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/register">
              <Button size="lg" className="rounded-full text-base px-8 shadow-md hover:shadow-lg transition-all h-14">
                Start Free Trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground sm:ml-4">No credit card required</p>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="bg-muted py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-serif text-4xl font-bold text-foreground mb-4">From workshop to showroom in 3 steps</h2>
              <p className="text-muted-foreground text-lg">No design skills or expensive lighting setups needed.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  icon: Camera,
                  title: "1. Snap a quick photo",
                  description: "Take a picture of your finished piece right in your garage or workshop. Don't worry about the mess in the background."
                },
                {
                  icon: Eraser,
                  title: "2. Let AI clean it up",
                  description: "Our AI instantly removes messy backgrounds and places your furniture in a beautifully styled, realistic living room."
                },
                {
                  icon: PenTool,
                  title: "3. Generate the listing",
                  description: "We'll write professional, engaging ad copy tailored for Facebook Marketplace or Craigslist, complete with pricing and condition."
                }
              ].map((step, i) => (
                <div key={i} className="bg-card p-8 rounded-2xl shadow-sm border border-border">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Preview Section */}
        <section id="pricing" className="py-24 px-6 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl font-bold text-foreground mb-4">Simple, honest pricing</h2>
            <p className="text-muted-foreground text-lg">Pay for itself with your first extra sale.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Trial */}
            <div className="bg-card p-8 rounded-3xl border border-border shadow-sm">
              <h3 className="text-2xl font-bold text-foreground mb-2">Free Trial</h3>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
              </div>
              <p className="text-muted-foreground mb-8 pb-8 border-b border-border">Perfect for your next flip to see the magic.</p>
              <ul className="space-y-4 mb-8">
                {["3 free AI generations", "Background removal", "Room staging", "Ad copy generation"].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button variant="outline" className="w-full rounded-xl h-12 border-primary text-primary hover:bg-primary/5">Start Trial</Button>
              </Link>
            </div>
            
            {/* Pro Plan */}
            <div className="bg-secondary text-secondary-foreground p-8 rounded-3xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">POPULAR</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro Flipper</h3>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$9.99</span>
                <span className="text-secondary-foreground/70">/month</span>
              </div>
              <p className="text-secondary-foreground/80 mb-8 pb-8 border-b border-secondary-foreground/20">For serious flippers who list multiple items a week.</p>
              <ul className="space-y-4 mb-8">
                {["Unlimited AI generations", "All premium room styles", "Priority processing", "Ad copy templates", "Cancel anytime"].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full rounded-xl h-12 bg-primary text-primary-foreground hover:bg-primary/90">Get Pro</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6 bg-card text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-serif font-bold text-lg text-foreground tracking-tight">FurniFlip</span>
        </div>
        <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} FurniFlip. Built for the hustle.</p>
      </footer>
    </div>
  );
}
