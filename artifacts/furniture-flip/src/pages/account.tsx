import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetMe, customFetch } from "@workspace/api-client-react";
import { Loader2, KeyRound, BrainCircuit, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AiSettings = {
  id: number;
  email: string;
  plan: "free" | "pro";
  trialUsed: number;
  trialLimit: number;
  modelProvider: string;
  textModel: string;
  imageModel: string;
  multimodalModel: string;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  googleApiKey: string | null;
  xaiApiKey: string | null;
  mistralApiKey: string | null;
};

const providerOptions = ["openai", "anthropic", "google", "xai", "mistral"];
const MASK = "••••••••";

export default function AccountSettings() {
  const { data: user } = useGetMe();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [modelProvider, setModelProvider] = useState("openai");
  const [textModel, setTextModel] = useState("gpt-4.1");
  const [imageModel, setImageModel] = useState("gpt-image-1");
  const [multimodalModel, setMultimodalModel] = useState("gpt-4.1");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [xaiApiKey, setXaiApiKey] = useState("");
  const [mistralApiKey, setMistralApiKey] = useState("");

  useEffect(() => {
    let mounted = true;
    customFetch<AiSettings>("/api/settings/ai")
      .then((settings) => {
        if (!mounted) return;
        setModelProvider(settings.modelProvider);
        setTextModel(settings.textModel);
        setImageModel(settings.imageModel);
        setMultimodalModel(settings.multimodalModel);
        setOpenaiApiKey(settings.openaiApiKey ? MASK : "");
        setAnthropicApiKey(settings.anthropicApiKey ? MASK : "");
        setGoogleApiKey(settings.googleApiKey ? MASK : "");
        setXaiApiKey(settings.xaiApiKey ? MASK : "");
        setMistralApiKey(settings.mistralApiKey ? MASK : "");
      })
      .catch(() => {
        toast({ title: "Could not load settings", description: "Please try again.", variant: "destructive" });
      });
    return () => {
      mounted = false;
    };
  }, [toast]);

  const defaults = useMemo(
    () => ({
      textModel: user?.plan === "pro" ? "gpt-4.1" : "gpt-4.1-mini",
      imageModel: "gpt-image-1",
      multimodalModel: user?.plan === "pro" ? "gpt-4.1" : "gpt-4.1-mini",
    }),
    [user?.plan]
  );

  const onSave = async () => {
    setLoading(true);
    try {
      await customFetch("/api/settings/ai", {
        method: "PUT",
        body: JSON.stringify({
          modelProvider,
          textModel,
          imageModel,
          multimodalModel,
          openaiApiKey: openaiApiKey === MASK ? undefined : openaiApiKey,
          anthropicApiKey: anthropicApiKey === MASK ? undefined : anthropicApiKey,
          googleApiKey: googleApiKey === MASK ? undefined : googleApiKey,
          xaiApiKey: xaiApiKey === MASK ? undefined : xaiApiKey,
          mistralApiKey: mistralApiKey === MASK ? undefined : mistralApiKey,
        }),
      });
      toast({ title: "Settings saved", description: "Your API keys and model defaults are updated." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Could not save settings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
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
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">Account & AI settings</h1>
          <p className="text-muted-foreground mt-1">Add your own API keys and choose default models for your account.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Provider keys</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Keys are stored on your account so Pro users can swap between frontier models without changing the app code.
            </p>

            {[
              { label: "OpenAI API key", value: openaiApiKey, setter: setOpenaiApiKey },
              { label: "Anthropic API key", value: anthropicApiKey, setter: setAnthropicApiKey },
              { label: "Google API key", value: googleApiKey, setter: setGoogleApiKey },
              { label: "xAI API key", value: xaiApiKey, setter: setXaiApiKey },
              { label: "Mistral API key", value: mistralApiKey, setter: setMistralApiKey },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <Label>{item.label}</Label>
                <Input
                  type="password"
                  placeholder="Paste key or leave blank"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                />
              </div>
            ))}
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Default models</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Pro defaults are prefilled to strong frontier models, but you can change them to any model your keys support.
            </p>

            <div className="space-y-2">
              <Label>Model provider</Label>
              <Select value={modelProvider} onValueChange={setModelProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default text model</Label>
              <Input value={textModel} onChange={(e) => setTextModel(e.target.value)} placeholder={defaults.textModel} />
            </div>

            <div className="space-y-2">
              <Label>Default image model</Label>
              <Input value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder={defaults.imageModel} />
            </div>

            <div className="space-y-2">
              <Label>Default multimodal model</Label>
              <Input
                value={multimodalModel}
                onChange={(e) => setMultimodalModel(e.target.value)}
                placeholder={defaults.multimodalModel}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Suggested Pro defaults: gpt-4.1 for text and multimodal, gpt-image-1 for images.</span>
            </div>
          </section>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={loading} className="rounded-xl px-6">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save settings
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
