import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Copy,
  Hammer,
  ImagePlus,
  Images,
  Lightbulb,
  ListChecks,
  Palette,
  Plus,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const beforeDresser = `${import.meta.env.BASE_URL}demo/dresser-before.avif`;
const finishedDresser = `${import.meta.env.BASE_URL}demo/dresser-after.avif`;

type JourneyStep = "vision" | "moodboard" | "refinishing" | "finished" | "listing";

type Concept = {
  id: string;
  eyebrow: string;
  name: string;
  description: string;
  palette: string[];
  treatment: string[];
  effort: string;
  resale: string;
};

const steps: Array<{ id: JourneyStep; label: string; shortLabel: string; icon: typeof Sparkles }> = [
  { id: "vision", label: "Understand the piece", shortLabel: "Vision", icon: Lightbulb },
  { id: "moodboard", label: "Build the direction", shortLabel: "Moodboard", icon: Palette },
  { id: "refinishing", label: "Do the work", shortLabel: "Refinish", icon: Hammer },
  { id: "finished", label: "Upload the result", shortLabel: "Finished", icon: ClipboardCheck },
  { id: "listing", label: "Stage & list", shortLabel: "Listing", icon: WandSparkles },
];

const concepts: Concept[] = [
  {
    id: "natural",
    eyebrow: "Direction 01",
    name: "Warm natural revival",
    description: "Celebrate the original character with repaired veneer, a warm walnut tone, and restrained brass hardware.",
    palette: ["#4a2e20", "#956c4d", "#d4b38e", "#b08a4a"],
    treatment: ["Repair loose veneer", "Sand to an even finish", "Warm walnut stain", "Satin protective coat"],
    effort: "4–6 days",
    resale: "Broad appeal",
  },
  {
    id: "contrast",
    eyebrow: "Direction 02 · Best fit",
    name: "Blush & ebonized contrast",
    description: "Keep the frame graphic and dark while softening the drawer fronts with a muted blush wash and warm brass details.",
    palette: ["#211f1d", "#d8b5ae", "#ead8cf", "#a98449"],
    treatment: ["Repair and fill veneer", "Ebonize outer frame", "Blush color wash", "Replace missing pulls"],
    effort: "5–7 days",
    resale: "Statement piece",
  },
  {
    id: "modern",
    eyebrow: "Direction 03",
    name: "Quiet sage modern",
    description: "Unify damaged surfaces with a calm sage enamel, preserving a natural top for warmth and everyday durability.",
    palette: ["#68765f", "#aab39d", "#d8d1c4", "#6b4935"],
    treatment: ["Prime damaged veneer", "Paint satin sage", "Strip and seal top", "Simple aged-brass pulls"],
    effort: "3–5 days",
    resale: "Fastest turnaround",
  },
];

const initialAnswers = {
  goal: "resale",
  preserve: "Some natural wood",
  experience: "Comfortable with the basics",
  priorities: ["Strong resale appeal", "Durable finish"],
  notes: "The veneer is badly damaged in a few areas. I like mid-century shapes and warm, muted colors.",
};

function StepRail({ active, onChange }: { active: JourneyStep; onChange: (step: JourneyStep) => void }) {
  const activeIndex = steps.findIndex((step) => step.id === active);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[760px] items-center">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const complete = index < activeIndex;
          const current = step.id === active;

          return (
            <div key={step.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => onChange(step.id)}
                className="group flex items-center gap-3 text-left"
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    current
                      ? "border-primary bg-primary text-primary-foreground"
                      : complete
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground group-hover:border-primary/40"
                  }`}
                >
                  {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span>
                  <span className={`block text-[11px] font-bold uppercase tracking-[0.14em] ${current ? "text-primary" : "text-muted-foreground"}`}>
                    Step {index + 1}
                  </span>
                  <span className="block whitespace-nowrap text-sm font-semibold text-foreground">{step.shortLabel}</span>
                </span>
              </button>
              {index < steps.length - 1 && <div className={`mx-4 h-px flex-1 ${index < activeIndex ? "bg-primary/50" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectImage({ src, label }: { src: string; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
      <img src={src} alt={label} className="aspect-[4/3] h-full w-full object-cover" />
      <div className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm backdrop-blur">
        {label}
      </div>
    </div>
  );
}

function ConceptCard({ concept, selected, onSelect }: { concept: Concept; selected: boolean; onSelect: () => void }) {
  return (
    <article className={`flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all ${selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:-translate-y-0.5 hover:shadow-md"}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{concept.eyebrow}</p>
          <h3 className="mt-1 font-serif text-2xl font-bold leading-tight text-foreground">{concept.name}</h3>
        </div>
        {selected && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" /></span>}
      </div>

      <div className="mb-5 flex gap-2" aria-label={`${concept.name} color palette`}>
        {concept.palette.map((color) => <span key={color} className="h-10 flex-1 rounded-lg border border-black/5" style={{ backgroundColor: color }} />)}
      </div>

      <p className="text-sm leading-6 text-muted-foreground">{concept.description}</p>

      <div className="my-5 space-y-2 border-y border-border py-4">
        {concept.treatment.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            {item}
          </div>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted/70 p-3"><span className="block text-xs text-muted-foreground">Estimated effort</span><strong>{concept.effort}</strong></div>
        <div className="rounded-xl bg-muted/70 p-3"><span className="block text-xs text-muted-foreground">Resale angle</span><strong>{concept.resale}</strong></div>
      </div>

      <Button type="button" variant={selected ? "default" : "outline"} onClick={onSelect} className="mt-auto w-full rounded-xl">
        {selected ? "Direction selected" : "Choose this direction"}
      </Button>
    </article>
  );
}

export default function JourneyPreview() {
  const { toast } = useToast();
  const inspirationInput = useRef<HTMLInputElement>(null);
  const finishedInput = useRef<HTMLInputElement>(null);
  const [activeStep, setActiveStep] = useState<JourneyStep>("vision");
  const [answers, setAnswers] = useState(initialAnswers);
  const [selectedConcept, setSelectedConcept] = useState("contrast");
  const [inspiration, setInspiration] = useState<string[]>([]);
  const [finishedPhoto, setFinishedPhoto] = useState<string>(finishedDresser);
  const [completedTasks, setCompletedTasks] = useState([true, true, false, false]);
  const [copied, setCopied] = useState(false);

  const activeConcept = useMemo(() => concepts.find((concept) => concept.id === selectedConcept) ?? concepts[1], [selectedConcept]);
  const activeIndex = steps.findIndex((step) => step.id === activeStep);

  const goNext = () => {
    const next = steps[Math.min(activeIndex + 1, steps.length - 1)];
    setActiveStep(next.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addUploadedImages = (files: FileList | null, target: "inspiration" | "finished") => {
    if (!files?.length) return;
    const urls = Array.from(files).map((file) => URL.createObjectURL(file));
    if (target === "inspiration") {
      setInspiration((current) => [...current, ...urls]);
      toast({ title: "Inspiration added", description: "Your moodboard now includes the new reference." });
    } else {
      setFinishedPhoto(urls[0]);
      toast({ title: "Finished photo ready", description: "The listing phase will use this real completed piece." });
    }
  };

  const copyListing = async () => {
    await navigator.clipboard.writeText("Restored Mid-Century Nine-Drawer Dresser\n\nA one-of-a-kind vintage dresser, fully restored with a graphic ebonized frame, soft blush-washed drawer fronts, and warm brass hardware. All drawers work smoothly and the finish has been sealed for everyday use.");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground [background-image:radial-gradient(circle_at_top_left,rgba(255,250,240,0.92),transparent_42%),linear-gradient(180deg,rgba(121,91,64,0.035),transparent_35%)]">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 shadow-[0_1px_0_rgba(82,57,37,0.04)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground" aria-label="Back to home">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-serif text-xl font-bold">FurniFlip</span>
            </div>
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:inline">Journey preview</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">MCM dresser transformation</p>
            <p className="text-xs text-muted-foreground">Saved just now</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-6 md:px-8 md:py-8">
        <section className="relative mb-7 min-h-[230px] overflow-hidden rounded-[1.75rem] border border-[#72533d]/25 bg-secondary shadow-[0_22px_60px_rgba(75,52,34,0.16)]">
          <img
            src={`${import.meta.env.BASE_URL}hero-refinishing-workshop.avif`}
            alt="Furniture refinisher hand-sanding a vintage dresser in a warm workshop"
            className="absolute inset-0 h-full w-full object-cover object-[68%_45%] opacity-90"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(50,34,24,0.97)_0%,rgba(50,34,24,0.86)_36%,rgba(50,34,24,0.25)_69%,rgba(50,34,24,0.05)_100%)]" />
          <div className="relative z-10 flex min-h-[230px] max-w-xl flex-col justify-center p-7 text-[#fff9ef] md:p-10">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#cbd3bd]">
              <Hammer className="h-4 w-4" /> From rough find to ready-to-sell
            </div>
            <h1 className="font-serif text-3xl font-bold leading-tight md:text-4xl">The whole flip, in one thoughtful workspace.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#f4e8d8]/80 md:text-base">Plan the transformation, do the real work, then turn the finished piece into a listing that feels true to what you made.</p>
          </div>
        </section>

        <div className="mb-8 rounded-2xl border border-border bg-card/95 px-5 py-4 shadow-[0_10px_28px_rgba(78,54,35,0.08)] md:px-6">
          <StepRail active={activeStep} onChange={setActiveStep} />
        </div>

        {activeStep === "vision" && (
          <section className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Before we design</p>
                <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight md:text-5xl">Tell us what you see in this piece.</h1>
                <p className="mt-3 max-w-xl leading-7 text-muted-foreground">The AI isolates the furniture, notes visible damage, then learns how you want to approach the refinish before suggesting anything.</p>
              </div>
              <ProjectImage src={beforeDresser} label="Original · Before photo" />
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-primary" /> AI observations</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Likely a nine-drawer mid-century dresser with widespread veneer loss, surface scratches, missing pulls, and a structurally promising frame.</p>
                <p className="mt-3 text-xs font-semibold text-primary">Confirm materials in person before sanding or stripping.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
              <div className="mb-7 flex items-center justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Guided intake</p><h2 className="mt-1 font-serif text-3xl font-bold">Shape the creative brief</h2></div>
                <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">About 2 minutes</span>
              </div>

              <div className="space-y-7">
                <div>
                  <Label className="text-base">What is the main goal for this piece?</Label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {["resale", "personal", "portfolio"].map((value) => (
                      <button key={value} type="button" onClick={() => setAnswers({ ...answers, goal: value })} className={`rounded-xl border p-3 text-left text-sm font-semibold capitalize transition-colors ${answers.goal === value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>{value}</button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div><Label htmlFor="preserve">What should we preserve?</Label><Input id="preserve" className="mt-2 h-11 bg-background" value={answers.preserve} onChange={(event) => setAnswers({ ...answers, preserve: event.target.value })} /></div>
                  <div><Label htmlFor="experience">Your refinishing comfort level</Label><Input id="experience" className="mt-2 h-11 bg-background" value={answers.experience} onChange={(event) => setAnswers({ ...answers, experience: event.target.value })} /></div>
                </div>

                <div>
                  <Label>What matters most?</Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Strong resale appeal", "Durable finish", "Quick turnaround", "Preserve character", "Try something bold"].map((priority) => {
                      const active = answers.priorities.includes(priority);
                      return <button key={priority} type="button" onClick={() => setAnswers({ ...answers, priorities: active ? answers.priorities.filter((item) => item !== priority) : [...answers.priorities, priority] })} className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40"}`}>{priority}</button>;
                    })}
                  </div>
                </div>

                <div><Label htmlFor="notes">What are you already thinking?</Label><Textarea id="notes" className="mt-2 min-h-28 bg-background" value={answers.notes} onChange={(event) => setAnswers({ ...answers, notes: event.target.value })} /></div>
              </div>

              <div className="mt-8 flex justify-end border-t border-border pt-6"><Button size="lg" className="rounded-xl px-6" onClick={goNext}>Build my moodboard <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
            </div>
          </section>
        )}

        {activeStep === "moodboard" && (
          <section className="space-y-8">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your creative workspace</p><h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">Three ways this piece could go.</h1><p className="mt-3 max-w-3xl leading-7 text-muted-foreground">Each direction respects your constraints but makes a different trade-off. Add inspiration, choose a direction, or ask the AI to rethink the plan.</p></div>
              <Button variant="outline" className="rounded-xl" onClick={() => inspirationInput.current?.click()}><ImagePlus className="mr-2 h-4 w-4" /> Add inspiration</Button>
              <input ref={inspirationInput} type="file" multiple accept="image/*" className="hidden" onChange={(event) => addUploadedImages(event.target.files, "inspiration")} />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">{concepts.map((concept) => <ConceptCard key={concept.id} concept={concept} selected={selectedConcept === concept.id} onSelect={() => setSelectedConcept(concept.id)} />)}</div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Moodboard</p><h2 className="mt-1 font-serif text-2xl font-bold">Your inspiration</h2></div><Button size="sm" variant="ghost" onClick={() => inspirationInput.current?.click()}><Plus className="mr-1 h-4 w-4" /> Add</Button></div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ProjectImage src={beforeDresser} label="Source piece" />
                  {inspiration.map((src, index) => <ProjectImage key={src} src={src} label={`Inspiration ${index + 1}`} />)}
                  <button type="button" onClick={() => inspirationInput.current?.click()} className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"><Plus className="mb-2 h-5 w-5" />Add a reference</button>
                </div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Selected plan</p><h2 className="mt-2 font-serif text-2xl font-bold">{activeConcept.name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">You can combine elements from the other directions later. This becomes the working plan, not a locked contract.</p>
                <Button className="mt-6 w-full rounded-xl" onClick={goNext}>Use this as my starting plan <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          </section>
        )}

        {activeStep === "refinishing" && (
          <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Plan approved</p><h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">Now make it real.</h1><p className="mt-3 leading-7 text-muted-foreground">The project stays with you while you work. Check off the plan, add progress notes, and come back when the physical piece is complete.</p><div className="mt-6"><ProjectImage src={beforeDresser} label="Starting condition" /></div></div>
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Working plan</p><h2 className="mt-1 font-serif text-2xl font-bold">{activeConcept.name}</h2></div><span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">In progress</span></div><div className="mt-5 space-y-3">{activeConcept.treatment.map((task, index) => <button key={task} type="button" onClick={() => setCompletedTasks((current) => current.map((done, taskIndex) => taskIndex === index ? !done : done))} className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50">{completedTasks[index] ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}<span className={completedTasks[index] ? "text-muted-foreground line-through" : "font-medium"}>{task}</span></button>)}</div></div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><UploadCloud className="h-5 w-5" /></div><div><h3 className="font-serif text-xl font-bold">Finished the physical piece?</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Upload the real completed photos. FurniFlip will use those—not the concept direction—as the source of truth for listing images.</p><Button className="mt-4 rounded-xl" onClick={() => finishedInput.current?.click()}>Upload finished photos</Button></div></div></div>
            </div>
          </section>
        )}

        {activeStep === "finished" && (
          <section className="space-y-8">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">The handoff</p><h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">Show us what you actually made.</h1><p className="mt-3 max-w-3xl leading-7 text-muted-foreground">These completed photos become the listing source of truth. AI can clean the setting and build lifestyle scenes, but it should not redesign the furniture.</p></div>
            <div className="grid gap-6 lg:grid-cols-2"><ProjectImage src={beforeDresser} label="Before · Project record" /><ProjectImage src={finishedPhoto} label="After · Verified completed photo" /></div>
            <input ref={finishedInput} type="file" accept="image/*" className="hidden" onChange={(event) => addUploadedImages(event.target.files, "finished")} />
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="grid gap-3 sm:grid-cols-3">{["Furniture is fully visible", "Finish and hardware are clear", "Ready for background cleanup"].map((item) => <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-semibold"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />{item}</div>)}</div>
              <div className="flex gap-3"><Button variant="outline" className="rounded-xl" onClick={() => finishedInput.current?.click()}>Replace photo</Button><Button className="rounded-xl" onClick={goNext}>Continue to listing <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
            </div>
          </section>
        )}

        {activeStep === "listing" && (
          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Step 5 · Listing studio</p><h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">From finished piece to polished listing.</h1><p className="mt-3 leading-7 text-muted-foreground">The existing staging journey starts here, using your completed piece rather than the original before photo.</p></div><ProjectImage src={finishedPhoto} label="Recommended cover · Completed piece" /><div className="grid grid-cols-3 gap-3"><div className="rounded-xl border border-primary bg-card p-3 text-center text-xs font-bold text-primary">Original after</div><div className="rounded-xl border border-border bg-card p-3 text-center text-xs font-semibold text-muted-foreground">Clean cutout</div><div className="rounded-xl border border-border bg-card p-3 text-center text-xs font-semibold text-muted-foreground">Lifestyle scene</div></div></div>
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /><h2 className="font-serif text-2xl font-bold">Marketplace draft</h2></div><h3 className="mt-6 text-xl font-bold">Restored Mid-Century Nine-Drawer Dresser</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">A one-of-a-kind vintage dresser, fully restored with a graphic ebonized frame, soft blush-washed drawer fronts, and warm brass hardware. All drawers work smoothly and the finish has been sealed for everyday use.</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-muted p-4"><span className="block text-xs text-muted-foreground">Suggested price</span><strong className="text-xl">$685</strong></div><div className="rounded-xl bg-muted p-4"><span className="block text-xs text-muted-foreground">Condition</span><strong className="text-xl">Restored</strong></div></div><Button variant="outline" className="mt-5 w-full rounded-xl" onClick={copyListing}>{copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}{copied ? "Copied" : "Copy listing"}</Button></div>
              <div className="rounded-2xl bg-secondary p-6 text-secondary-foreground"><div className="flex items-center gap-2"><Images className="h-5 w-5 text-primary" /><h3 className="font-serif text-xl font-bold">Smart image pack</h3></div><p className="mt-2 text-sm leading-6 text-secondary-foreground/75">Keep the real completed photo, then generate clean-background and room-staged options without changing the piece itself.</p><Button className="mt-5 w-full rounded-xl">Build listing image pack</Button></div>
            </div>
          </section>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-border pt-5">
          <p className="hidden text-sm text-muted-foreground sm:block">Interactive product-flow preview · no AI credits used</p>
          <div className="ml-auto flex gap-3">
            {activeIndex > 0 && <Button variant="ghost" onClick={() => setActiveStep(steps[activeIndex - 1].id)}>Back</Button>}
            {activeIndex < steps.length - 1 && <Button variant="outline" className="rounded-xl" onClick={goNext}>Next step <ArrowRight className="ml-2 h-4 w-4" /></Button>}
          </div>
        </div>
      </main>
    </div>
  );
}
