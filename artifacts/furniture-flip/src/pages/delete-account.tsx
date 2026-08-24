import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";

export default function DeleteAccount() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    setError("");
    try {
      await customFetch("/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      setLocation("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account deletion failed");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  if (isError || !user) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background px-6">
        <section className="max-w-lg space-y-5 rounded-2xl border bg-card p-8 text-center">
          <h1 className="font-serif text-3xl font-bold">Delete your FurniFlip account</h1>
          <p className="text-muted-foreground">
            Sign in first so we can verify ownership and permanently remove your account, projects,
            uploaded images, generated images, and saved provider settings.
          </p>
          <Link href="/login?returnTo=/delete-account"><Button>Sign in to continue</Button></Link>
          <div><Link href="/privacy" className="text-sm text-primary underline">Read the privacy policy</Link></div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-background px-6 py-12">
      <section className="w-full max-w-lg space-y-6 rounded-2xl border border-destructive/30 bg-card p-8">
        <div className="space-y-2">
          <Trash2 className="h-8 w-8 text-destructive" />
          <h1 className="font-serif text-3xl font-bold">Permanently delete account</h1>
          <p className="text-muted-foreground">
            This deletes {user.email}, all projects, uploaded and generated images, saved AI-provider
            settings, and local subscription access. An active subscription will be cancelled first.
            This action cannot be undone.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-password">Current password</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
          <Input
            id="delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/account"><Button variant="outline">Cancel</Button></Link>
          <Button
            variant="destructive"
            disabled={deleting || !password || confirmation !== "DELETE"}
            onClick={deleteAccount}
          >
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete account forever
          </Button>
        </div>
      </section>
    </main>
  );
}
