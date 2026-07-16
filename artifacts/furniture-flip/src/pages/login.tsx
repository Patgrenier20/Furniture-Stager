import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isAuthLoading } = useGetMe();
  const login = useLogin();
  const { toast } = useToast();

  if (!isAuthLoading && user) {
    setLocation("/dashboard");
    return null;
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    login.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Welcome back", description: "Successfully logged in." });
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({ 
          title: "Login failed", 
          description: (error?.data as any)?.error || error?.message || "Invalid credentials", 
          variant: "destructive" 
        });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Left side - Form */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 lg:p-12 relative z-10">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 mb-12">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="font-serif font-bold text-xl text-foreground">FurniFlip</span>
          </Link>
          
          <h1 className="font-serif text-4xl font-bold text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-8">Enter your details to access your studio.</p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} className="h-12 bg-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="h-12 bg-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full h-12 text-base rounded-xl" disabled={login.isPending}>
                {login.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log In"}
              </Button>
            </form>
          </Form>
          
          <p className="text-center mt-8 text-muted-foreground text-sm">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden md:flex w-1/2 bg-secondary p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-30 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-secondary to-transparent opacity-80"></div>
        
        <div className="relative z-10 max-w-lg text-secondary-foreground text-center">
          <blockquote className="font-serif text-3xl font-medium leading-snug mb-6">
            "FurniFlip changed my business. My pieces sell twice as fast when I stage them in the AI mid-century room."
          </blockquote>
          <p className="text-secondary-foreground/80 font-medium tracking-wide uppercase text-sm">
            — Sarah Jenkins, Pro Flipper
          </p>
        </div>
      </div>
    </div>
  );
}
