import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetProject, getGetProjectQueryKey, useRemoveBackground, useStageRoom, 
  useGenerateAd, useGenerateTransformations, useDeleteProject, useGetMe,
  type Ad,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Eraser, Sparkles, PenLine, ArrowLeft, 
  Trash2, AlertCircle, Copy, CheckCircle2, Images, LockKeyhole,
} from "lucide-react";
import { Link } from "wouter";

type WorkflowStepHeaderProps = {
  number: number;
  title: string;
  description: string;
  complete?: boolean;
  locked?: boolean;
};

/**
 * Shared heading keeps the three-step workflow visually consistent and makes
 * each step's completion/locked state understandable without relying on color.
 */
function WorkflowStepHeader({ number, title, description, complete = false, locked = false }: WorkflowStepHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        complete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>
        {complete ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg font-bold text-foreground">{title}</h3>
          {locked && <LockKeyhole className="h-4 w-4 text-muted-foreground" aria-label="Locked" />}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function Studio() {
  const { id } = useParams();
  const projectId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetMe();

  const { data: project, isLoading, error } = useGetProject(projectId, { 
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } 
  });
  
  const removeBackground = useRemoveBackground();
  const stageRoom = useStageRoom();
  const generateTransformations = useGenerateTransformations();
  const generateAd = useGenerateAd();
  const deleteProject = useDeleteProject();

  const [activeImageId, setActiveImageId] = useState<number | null>(null);
  const [selectedTransformationId, setSelectedTransformationId] = useState<number | null>(null);
  const [stagedImageId, setStagedImageId] = useState<number | null>(null);
  const [includeModernBase, setIncludeModernBase] = useState(false);
  const [roomStyle, setRoomStyle] = useState<string>("modern");
  const [adCondition, setAdCondition] = useState<string>("good");
  const [adPrice, setAdPrice] = useState<string>("");
  const [copiedAdId, setCopiedAdId] = useState<number | null>(null);
  const [latestGeneratedAd, setLatestGeneratedAd] = useState<Ad | null>(null);
  const latestAdRef = useRef<HTMLDivElement | null>(null);
  const stageStepRef = useRef<HTMLDivElement | null>(null);
  const adStepRef = useRef<HTMLDivElement | null>(null);
  const initializedProjectRef = useRef<number | null>(null);

  // Auto-select newest image
  useEffect(() => {
    if (project?.images?.length) {
      const sorted = [...project.images].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      if (!activeImageId || !project.images.find(img => img.id === activeImageId)) {
        setActiveImageId(sorted[0].id);
      }
    }
  }, [project?.images, activeImageId]);

  // Restore a sensible workflow position when an existing project is opened.
  // This runs once per project so generating a fresh makeover set can
  // intentionally reset the downstream staging and ad steps.
  useEffect(() => {
    if (!project || initializedProjectRef.current === project.id) return;

    const newestFirst = [...project.images].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const newestTransformation = newestFirst.find((image) => image.type === "transformation");
    const newestStagedImage = newestFirst.find((image) => image.type === "staged");

    setSelectedTransformationId(newestTransformation?.id ?? null);
    setStagedImageId(newestStagedImage?.id ?? null);
    initializedProjectRef.current = project.id;
  }, [project]);

  // The ad used to render below a nested scroll area with no indication of
  // where it went. Reveal it immediately after generation so success and the
  // resulting copy are part of the same interaction.
  useEffect(() => {
    if (!latestGeneratedAd) return;

    const frame = requestAnimationFrame(() => {
      latestAdRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => cancelAnimationFrame(frame);
  }, [latestGeneratedAd]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold">Project not found</h2>
          <Link href="/projects"><Button className="mt-4">Back to Projects</Button></Link>
        </div>
      </DashboardLayout>
    );
  }

  const trialExhausted = user?.plan === "free" && user.trialUsed >= user.trialLimit;

  const handleRemoveBackground = () => {
    if (trialExhausted) return setLocation("/pricing");
    
    removeBackground.mutate({ id: projectId }, {
      onSuccess: async (image) => {
        // Refresh the exact generated project query before selecting the new
        // image. The old ad-hoc key did not match the query client's real key,
        // so the server-created cutout was saved but remained invisible.
        await queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setActiveImageId(image.id);
        toast({
          title: "Background removed",
          description: "The transparent cutout is selected and ready to use.",
        });
      },
      onError: (err) => toast({ title: "Error", description: (err?.data as any)?.error || err?.message || "Failed", variant: "destructive" })
    });
  };

  const handleStageRoom = () => {
    if (trialExhausted) return setLocation("/pricing");
    if (!selectedTransformationId) {
      toast({
        title: "Select a makeover first",
        description: "Choose one of the three makeover ideas before staging it in a room.",
        variant: "destructive",
      });
      return;
    }
    
    stageRoom.mutate({ 
      id: projectId, 
      data: { roomStyle: roomStyle as any, sourceImageId: selectedTransformationId }
    }, {
      onSuccess: async (image) => {
        setStagedImageId(image.id);
        setActiveImageId(image.id);
        await queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        toast({
          title: "Room staged successfully",
          description: "Your staged image is ready. Continue to Step 3 to write the ad.",
        });
        requestAnimationFrame(() => adStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      },
      onError: (err) => toast({ title: "Error", description: (err?.data as any)?.error || err?.message || "Failed", variant: "destructive" })
    });
  };

  const handleGenerateTransformations = () => {
    if (trialExhausted) return setLocation("/pricing");

    generateTransformations.mutate({ id: projectId, data: { includeModernBase } }, {
      onSuccess: async (images) => {
        await queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        if (images[0]) {
          setSelectedTransformationId(images[0].id);
          setActiveImageId(images[0].id);
        }
        // A new makeover set starts a new workflow. The user must stage their
        // chosen concept before ad generation becomes available again.
        setStagedImageId(null);
        setLatestGeneratedAd(null);
        toast({
          title: "Three makeover ideas are ready",
          description: "Choose your favorite below, then continue to Step 2.",
        });
        requestAnimationFrame(() => stageStepRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      },
      onError: (err) => toast({
        title: "Could not generate transformations",
        description: (err?.data as any)?.error || err?.message || "Please try again.",
        variant: "destructive",
      }),
    });
  };

  const handleGenerateAd = () => {
    if (trialExhausted) return setLocation("/pricing");
    if (!stagedImageId) {
      toast({
        title: "Stage your makeover first",
        description: "Complete Step 2 before writing the marketplace ad.",
        variant: "destructive",
      });
      return;
    }
    
    generateAd.mutate({
      id: projectId,
      data: { 
        condition: adCondition as any, 
        price: adPrice ? Number(adPrice) : undefined,
        imageId: stagedImageId
      }
    }, {
      onSuccess: (ad) => {
        setLatestGeneratedAd(ad);
        toast({
          title: "Marketplace ad ready",
          description: "Your finished listing is shown below the generator.",
        });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
      onError: (err) => toast({ title: "Error", description: (err?.data as any)?.error || err?.message || "Failed", variant: "destructive" })
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProject.mutate({ id: projectId }, {
        onSuccess: () => setLocation("/projects"),
        onError: (err) => toast({ title: "Error", description: "Could not delete", variant: "destructive" })
      });
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedAdId(id);
    setTimeout(() => setCopiedAdId(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const handleSelectTransformation = (imageId: number) => {
    const makeoverChanged = selectedTransformationId !== imageId;
    setSelectedTransformationId(imageId);
    setActiveImageId(imageId);

    // A staged scene belongs to one specific makeover. Changing the selected
    // concept requires a fresh stage so the final ad cannot use a stale image.
    if (makeoverChanged) {
      setStagedImageId(null);
      setLatestGeneratedAd(null);
    }
  };

  const activeImage = activeImageId
    ? project.images.find(img => img.id === activeImageId)?.imageUrl ?? project.originalImageUrl
    : project.originalImageUrl;

  const transformationLabels: Record<string, string> = {
    heritage_walnut: "Heritage Walnut",
    olive_two_tone: "Olive & Natural",
    olive_two_tone_modern_base: "Olive & Natural · Modern Base",
    light_natural: "Light Natural",
  };
  const transformationImages = [...project.images]
    .filter((image) => image.type === "transformation")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
    .reverse();
  const galleryImages = project.images.filter((image) => image.type !== "transformation");
  const latestAd = latestGeneratedAd ?? project.ads?.[0] ?? null;
  const previousAds = (project.ads ?? []).filter((ad) => ad.id !== latestAd?.id);

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 min-h-full max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-serif text-2xl font-bold text-foreground">{project.name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                Studio Editor 
                {trialExhausted && <span className="text-destructive font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Trial limit reached</span>}
              </p>
            </div>
          </div>
          <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
          {/* Left Column - Visuals */}
          <div className="min-w-0 flex flex-col gap-4">
            <div className="aspect-[4/3] bg-muted rounded-2xl border border-border overflow-hidden relative shadow-sm flex items-center justify-center min-h-[400px]">
              {removeBackground.isPending || stageRoom.isPending || generateTransformations.isPending ? (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                  <p className="font-medium text-lg">
                    {generateTransformations.isPending
                      ? "Creating three makeover directions..."
                      : removeBackground.isPending
                        ? "Removing the background..."
                        : "Staging your makeover..."}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {generateTransformations.isPending
                      ? "Three detailed image concepts can take a few minutes."
                      : removeBackground.isPending
                        ? "Preparing a transparent cutout; this may take about a minute."
                        : "Building a realistic room around the selected furniture."}
                  </p>
                </div>
              ) : null}
              <img src={activeImage} alt="Active preview" className="w-full h-full object-contain p-4" />
            </div>

            {/* Gallery Strip */}
            <div className="h-24 shrink-0 flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              <button 
                onClick={() => setActiveImageId(null)}
                className={`h-full aspect-[4/3] rounded-lg border-2 overflow-hidden shrink-0 transition-all ${!activeImageId ? 'border-primary shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={project.originalImageUrl} alt="Original" className="w-full h-full object-cover" />
              </button>
              {galleryImages.map((img) => (
                <button 
                  key={img.id}
                  onClick={() => setActiveImageId(img.id)}
                  className={`relative h-full aspect-[4/3] rounded-lg border-2 overflow-hidden shrink-0 transition-all ${activeImageId === img.id ? 'border-primary shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={img.imageUrl} alt={img.type} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                    {img.type === 'background_removed' ? 'No BG' : img.roomStyle}
                  </div>
                </button>
              ))}
            </div>

            {transformationImages.length > 0 && (
              <section className="space-y-3" aria-labelledby="transformation-heading">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 id="transformation-heading" className="font-serif text-xl font-bold text-foreground">
                      AI Transformation Ideas
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Select one makeover to continue to room staging in Step 2.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {transformationImages.map((image) => {
                    const isSelected = selectedTransformationId === image.id;
                    const label = transformationLabels[image.roomStyle ?? ""] ?? "Makeover concept";

                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => handleSelectTransformation(image.id)}
                        aria-pressed={isSelected}
                        className={`overflow-hidden rounded-xl border-2 bg-card text-left transition-all ${
                          isSelected
                            ? "border-primary shadow-md"
                            : "border-border hover:border-primary/50 hover:shadow-sm"
                        }`}
                      >
                        <img src={image.imageUrl} alt={label} className="aspect-[4/3] w-full object-cover" />
                        <span className="block px-3 py-2 text-sm font-semibold text-foreground">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Right Column - Tools */}
          <div className="min-w-0 flex flex-col gap-6">
            
            {/* Step 1: the user creates and chooses a makeover direction. */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <WorkflowStepHeader
                number={1}
                title="Create Makeover Ideas"
                description="Generate three finish concepts, then select your favorite."
                complete={Boolean(selectedTransformationId)}
              />
              
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <Images className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Explore three transformations</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        AI changes only the finish, paint, and hardware—not the furniture's shape or dimensions.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleGenerateTransformations}
                    disabled={removeBackground.isPending || stageRoom.isPending || generateTransformations.isPending || trialExhausted}
                  >
                    {generateTransformations.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating 3 Ideas...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" /> Generate 3 Makeover Ideas</>
                    )}
                  </Button>
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
                    <input
                      type="checkbox"
                      checked={includeModernBase}
                      onChange={(event) => setIncludeModernBase(event.target.checked)}
                      disabled={generateTransformations.isPending}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">Include one modern-base option</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        One concept may replace only the bottom base or legs. The cabinet body and drawer layout stay unchanged.
                      </span>
                    </span>
                  </label>
                </div>

                <Button 
                  variant="outline" 
                  className="w-full justify-start h-12" 
                  onClick={handleRemoveBackground}
                  disabled={removeBackground.isPending || stageRoom.isPending || generateTransformations.isPending || trialExhausted}
                >
                  {removeBackground.isPending ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Eraser className="w-5 h-5 mr-3 text-muted-foreground" />}
                  Remove Background
                </Button>
                <p className="text-xs text-muted-foreground">
                  Background removal is optional. Makeover ideas are always generated from the original upload.
                </p>
              </div>
            </div>

            {/* Step 2 stays visible but unavailable until a makeover is selected. */}
            <div
              ref={stageStepRef}
              className={`bg-card border rounded-2xl p-5 shadow-sm transition-colors ${
                selectedTransformationId ? "border-border" : "border-border/70 bg-muted/20"
              }`}
            >
              <WorkflowStepHeader
                number={2}
                title="Stage Your Makeover"
                description={selectedTransformationId
                  ? "Place the selected makeover in a room without redesigning the furniture."
                  : "Complete Step 1 and select a makeover to unlock staging."}
                complete={Boolean(stagedImageId)}
                locked={!selectedTransformationId}
              />

              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
                <label className="text-sm font-medium mb-2 block">Room style</label>
                <div className="flex gap-2">
                  <Select value={roomStyle} onValueChange={setRoomStyle} disabled={!selectedTransformationId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="mid_century">Mid-Century</SelectItem>
                      <SelectItem value="rustic">Rustic</SelectItem>
                      <SelectItem value="minimalist">Minimalist</SelectItem>
                      <SelectItem value="bohemian">Bohemian</SelectItem>
                      <SelectItem value="industrial">Industrial</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleStageRoom}
                    disabled={!selectedTransformationId || stageRoom.isPending || generateTransformations.isPending || trialExhausted}
                  >
                    {stageRoom.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Stage"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  The selected makeover's exact shape, dimensions, and construction are preserved.
                </p>
              </div>
            </div>

            {/* Step 3 uses only the staged image produced by Step 2. */}
            <div
              ref={adStepRef}
              className={`bg-card border rounded-2xl p-5 shadow-sm transition-colors ${
                stagedImageId ? "border-border" : "border-border/70 bg-muted/20"
              }`}
            >
              <WorkflowStepHeader
                number={3}
                title="Write Marketplace Ad"
                description={stagedImageId
                  ? "Add listing details and generate copy for the staged makeover."
                  : "Complete room staging in Step 2 to unlock the ad writer."}
                complete={Boolean(stagedImageId && latestAd)}
                locked={!stagedImageId}
              />
              
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Price ($)</label>
                    <Input 
                      type="number" 
                      placeholder="Optional" 
                      value={adPrice} 
                      onChange={e => setAdPrice(e.target.value)}
                      className="bg-background"
                      disabled={!stagedImageId}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Condition</label>
                    <Select value={adCondition} onValueChange={setAdCondition} disabled={!stagedImageId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="like_new">Like New</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Needs TLC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  className="w-full h-12" 
                  onClick={handleGenerateAd}
                  disabled={!stagedImageId || generateAd.isPending || trialExhausted}
                >
                  {generateAd.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Writing Copy...</>
                  ) : <><PenLine className="mr-2 h-4 w-4" /> Write Marketplace Ad</>}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Your finished title and description will appear directly below this form.
                </p>
              </div>
            </div>

            {/* The newest generated ad is promoted into a full result panel. */}
            {latestAd && (
              <section ref={latestAdRef} className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm" aria-labelledby="marketplace-ad-heading">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ready to post</p>
                    <h3 id="marketplace-ad-heading" className="font-serif text-xl font-bold text-foreground">
                      Your Marketplace Ad
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      `${latestAd.title}\n\n${latestAd.price ? `$${latestAd.price}\n\n` : ""}${latestAd.description}`,
                      latestAd.id,
                    )}
                  >
                    {copiedAdId === latestAd.id ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Copied</>
                    ) : (
                      <><Copy className="mr-2 h-4 w-4" /> Copy Full Ad</>
                    )}
                  </Button>
                </div>

                <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                  <h4 className="font-bold text-foreground">{latestAd.title}</h4>
                  {latestAd.price && <p className="text-lg font-bold text-primary">${latestAd.price}</p>}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {latestAd.description}
                  </p>
                </div>
              </section>
            )}

            {previousAds.length > 0 && (
              <details className="rounded-xl border border-border bg-card p-4">
                <summary className="cursor-pointer font-semibold text-foreground">
                  Previous ads ({previousAds.length})
                </summary>
                <div className="mt-4 space-y-3">
                  {previousAds.map((ad) => (
                    <div key={ad.id} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold text-foreground">{ad.title}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(
                            `${ad.title}\n\n${ad.price ? `$${ad.price}\n\n` : ""}${ad.description}`,
                            ad.id,
                          )}
                        >
                          {copiedAdId === ad.id ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span className="sr-only">Copy {ad.title}</span>
                        </Button>
                      </div>
                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{ad.description}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
