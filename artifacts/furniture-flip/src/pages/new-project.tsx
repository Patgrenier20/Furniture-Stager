import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetMe, customFetch } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import type { Project } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, Image as ImageIcon, X, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
});

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const createProject = useMutation({
    mutationFn: (formData: FormData) =>
      customFetch<Project>("/api/projects", { method: "POST", body: formData }),
  });
  const { toast } = useToast();
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trialExhausted = user?.plan === "free" && user.trialUsed >= user.trialLimit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!imageFile) {
      toast({ title: "Image required", description: "Please upload an image of your furniture.", variant: "destructive" });
      return;
    }
    if (trialExhausted) {
      toast({ title: "Trial Exhausted", description: "Please upgrade to pro to create more projects.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("name", values.name);
    if (values.description) formData.append("description", values.description);
    formData.append("image", imageFile);

    createProject.mutate(formData, {
      onSuccess: (project) => {
        toast({ title: "Project created", description: "Taking you to the studio..." });
        setLocation(`/projects/${project.id}`);
      },
      onError: (error) => {
        const message =
          (error as any)?.data?.error ??
          (error as any)?.message ??
          "Could not create project";

        toast({ title: "Upload failed", description: message, variant: "destructive" });
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">New Project</h1>
            <p className="text-muted-foreground mt-1">Upload a photo to start editing.</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Mid Century Dresser" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Bought for $40, fixed leg..." className="resize-none h-24 bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium leading-none">Original Photo</label>
                  {previewUrl ? (
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border group">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button type="button" variant="destructive" size="sm" onClick={removeImage}>
                          <X className="w-4 h-4 mr-2" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="aspect-[4/3] rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center p-6 bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <UploadCloud className="w-6 h-6 text-primary" />
                      </div>
                      <p className="font-medium text-foreground mb-1">Click to upload photo</p>
                      <p className="text-xs text-muted-foreground text-center">JPEG, PNG or WEBP<br/>Best results in good lighting.</p>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageChange} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={createProject.isPending || !imageFile || trialExhausted}
                  className="rounded-xl px-8"
                >
                  {createProject.isPending ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    "Create Project & Go to Studio"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </DashboardLayout>
  );
}
