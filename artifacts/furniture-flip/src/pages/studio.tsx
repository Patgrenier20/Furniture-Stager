import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { 
  useGetProject, getGetProjectQueryKey, useRemoveBackground, useStageRoom, 
  useGenerateAd, useDeleteProject, useGetMe 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Eraser, Sparkles, PenLine, ArrowLeft, 
  Trash2, AlertCircle, Copy, CheckCircle2 
} from "lucide-react";
import { Link } from "wouter";

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
  const generateAd = useGenerateAd();
  const deleteProject = useDeleteProject();

  const [activeImageId, setActiveImageId] = useState<number | null>(null);
  const [roomStyle, setRoomStyle] = useState<string>("modern");
  const [adCondition, setAdCondition] = useState<string>("good");
  const [adPrice, setAdPrice] = useState<string>("");
  const [copiedAdId, setCopiedAdId] = useState<number | null>(null);

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
      onSuccess: () => {
        toast({ title: "Background removed" });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
      onError: (err) => toast({ title: "Error", description: (err?.data as any)?.error || err?.message || "Failed", variant: "destructive" })
    });
  };

  const handleStageRoom = () => {
    if (trialExhausted) return setLocation("/pricing");
    
    stageRoom.mutate({ 
      id: projectId, 
      data: { roomStyle: roomStyle as any, sourceImageId: activeImageId } 
    }, {
      onSuccess: () => {
        toast({ title: "Room staged successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
      onError: (err) => toast({ title: "Error", description: (err?.data as any)?.error || err?.message || "Failed", variant: "destructive" })
    });
  };

  const handleGenerateAd = () => {
    if (trialExhausted) return setLocation("/pricing");
    
    generateAd.mutate({
      id: projectId,
      data: { 
        condition: adCondition as any, 
        price: adPrice ? Number(adPrice) : undefined,
        imageId: activeImageId 
      }
    }, {
      onSuccess: () => {
        toast({ title: "Ad generated successfully" });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
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

  const activeImage = activeImageId 
    ? project.images.find(img => img.id === activeImageId)?.imageUrl 
    : project.originalImageUrl;

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 h-[calc(100dvh-0px)] flex flex-col max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 shrink-0">
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

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
          {/* Left Column - Visuals */}
          <div className="w-full lg:w-3/5 flex flex-col gap-4">
            <div className="flex-1 bg-muted rounded-2xl border border-border overflow-hidden relative shadow-sm flex items-center justify-center min-h-[400px]">
              {removeBackground.isPending || stageRoom.isPending ? (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                  <p className="font-medium text-lg">AI is working its magic...</p>
                  <p className="text-muted-foreground text-sm">This usually takes about 5-10 seconds.</p>
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
              {project.images.map((img) => (
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
          </div>

          {/* Right Column - Tools */}
          <div className="w-full lg:w-2/5 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* Tool: Image Editing */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary"/> Edit Image</h3>
              
              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-12" 
                  onClick={handleRemoveBackground}
                  disabled={removeBackground.isPending || stageRoom.isPending || trialExhausted}
                >
                  {removeBackground.isPending ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <Eraser className="w-5 h-5 mr-3 text-muted-foreground" />}
                  Remove Background
                </Button>

                <div className="p-4 bg-muted/50 rounded-xl border border-border">
                  <label className="text-sm font-medium mb-2 block">Stage in Room</label>
                  <div className="flex gap-2">
                    <Select value={roomStyle} onValueChange={setRoomStyle}>
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
                      disabled={removeBackground.isPending || stageRoom.isPending || trialExhausted}
                    >
                      {stageRoom.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Stage"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Stages the currently selected image.</p>
                </div>
              </div>
            </div>

            {/* Tool: Ad Generation */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h3 className="font-serif text-lg font-bold mb-4 flex items-center gap-2"><PenLine className="w-5 h-5 text-primary"/> Generate Ad</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Price ($)</label>
                    <Input 
                      type="number" 
                      placeholder="Optional" 
                      value={adPrice} 
                      onChange={e => setAdPrice(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Condition</label>
                    <Select value={adCondition} onValueChange={setAdCondition}>
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
                  disabled={generateAd.isPending || trialExhausted}
                >
                  {generateAd.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Writing Copy...</>
                  ) : "Write Marketplace Ad"}
                </Button>
              </div>
            </div>

            {/* Generated Ads */}
            {project.ads?.length > 0 && (
              <div className="space-y-4 mt-2">
                <h3 className="font-serif text-lg font-bold">Generated Ads</h3>
                {[...project.ads].reverse().map(ad => (
                  <div key={ad.id} className="bg-card border border-border rounded-xl p-4 shadow-sm group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground">{ad.title}</h4>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(`${ad.title}\n\n${ad.price ? `$${ad.price}\n\n` : ''}${ad.description}`, ad.id)}
                      >
                        {copiedAdId === ad.id ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    {ad.price && <div className="text-primary font-bold mb-2">${ad.price}</div>}
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ad.description}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
