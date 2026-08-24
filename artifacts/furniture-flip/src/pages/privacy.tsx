import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-dvh bg-background px-6 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3">
          <p className="text-sm font-medium text-primary">FurniFlip</p>
          <h1 className="font-serif text-4xl font-bold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Effective August 23, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information we process</h2>
          <p className="text-muted-foreground leading-7">
            FurniFlip processes your email address, encrypted password, account and subscription status,
            furniture project details, uploaded and generated images, AI model preferences, and usage totals.
            If you provide an AI-provider API key, it is encrypted before storage and used only to perform
            the generation requests you initiate.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How information is used</h2>
          <p className="text-muted-foreground leading-7">
            We use this information to authenticate you, store and display your projects, generate image
            edits and listing copy, prevent abuse, provide support, and maintain subscription entitlements.
            Project content is sent to the AI provider selected for the requested operation. Payment details
            are handled by the applicable billing provider and are not stored by FurniFlip.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Retention and security</h2>
          <p className="text-muted-foreground leading-7">
            Account and project data is retained while your account remains active. Provider keys are
            protected with authenticated AES-256-GCM encryption at rest. Network traffic must use HTTPS in
            production. No internet service can guarantee absolute security, so do not upload content you do
            not have permission to process.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Deletion and your choices</h2>
          <p className="text-muted-foreground leading-7">
            You can permanently delete your account and associated project data from Account &amp; AI settings
            or through the deletion page below. Active subscriptions are cancelled before deletion. Limited
            billing and security records may be retained where required by law or to resolve fraud and disputes.
          </p>
          <Link href="/delete-account">
            <Button variant="outline">Delete account or data</Button>
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground leading-7">
            Privacy and support requests may be submitted through the FurniFlip project repository at{
            " "
          }
            <a
              className="text-primary underline underline-offset-4"
              href="https://github.com/Patgrenier20/Furniture-Stager/issues"
              rel="noreferrer"
              target="_blank"
            >
              github.com/Patgrenier20/Furniture-Stager/issues
            </a>.
          </p>
        </section>

        <Link href="/">
          <Button>Return to FurniFlip</Button>
        </Link>
      </article>
    </main>
  );
}
