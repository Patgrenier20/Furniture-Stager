import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useGetMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isAuthLoading } = useGetMe();
  const register = useRegister();
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
    register.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Account created", description: "Welcome to FurniFlip!" });
        setLocation("/dashboard");
      },
      onError: (error) => {
        toast({ 
          title: "Registration failed", 
          description: (error?.data as any)?.error || error?.message || "Could not create account", 
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
          
          <h1 className="font-serif text-4xl font-bold text-foreground mb-2">Start your free trial</h1>
          <p className="text-muted-foreground mb-8">Get 3 free generations to see the magic.</p>

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
              <Button type="submit" className="w-full h-12 text-base rounded-xl" disabled={register.isPending}>
                {register.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
              </Button>
            </form>
          </Form>
          
          <p className="text-center mt-8 text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Benefits */}
      <div className="hidden md:flex w-1/2 bg-muted p-12 items-center justify-center relative">
        <div className="max-w-md">
          <h2 className="font-serif text-3xl font-bold text-foreground mb-8">Upgrade your listings</h2>
          <div className="space-y-6">
            {[
              { title: "Remove backgrounds instantly", desc: "No more messy garage shots." },
              { title: "Stage in any room", desc: "Choose from Modern, Rustic, Mid-Century and more." },
              { title: "AI-written copy", desc: "Get high-converting descriptions in seconds." }
            ].map((feature, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
