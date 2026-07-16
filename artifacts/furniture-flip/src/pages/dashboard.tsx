import { Link } from "wouter";
import { useGetProjectStats, useGetMe } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Images, PenLine, Plus, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectStats();
  const { data: user } = useGetMe();

  const trialExhausted = user?.plan === "free" && user.trialUsed >= user.trialLimit;

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back to your workshop.</p>
          </div>
          <Link href="/projects/new">
            <Button size="lg" className="rounded-xl shadow-sm" disabled={trialExhausted}>
              <Plus className="w-5 h-5 mr-2" /> New Project
            </Button>
          </Link>
        </div>

        {trialExhausted && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-destructive">Free trial limit reached</h3>
              <p className="text-sm text-destructive/80 mt-1 mb-3">You've used all {user.trialLimit} free edits. Upgrade to Pro to continue creating stunning listings.</p>
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  Upgrade to Pro
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
              <FolderKanban className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {statsLoading ? "-" : stats?.totalProjects || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Images Created</CardTitle>
              <Images className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {statsLoading ? "-" : stats?.totalImages || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ads Generated</CardTitle>
              <PenLine className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {statsLoading ? "-" : stats?.totalAds || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="font-serif text-2xl font-bold text-foreground mb-6">Recent Projects</h2>
          
          {statsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse bg-card h-64 rounded-xl border border-border"></div>
              ))}
            </div>
          ) : !stats?.recentProjects?.length ? (
            <div className="text-center py-16 bg-card border border-border border-dashed rounded-2xl">
              <Images className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Upload your first piece of furniture to start editing and generating listings.</p>
              <Link href="/projects/new">
                <Button>Create First Project</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.recentProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="group block">
                  <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {project.originalImageUrl ? (
                        <img 
                          src={project.originalImageUrl} 
                          alt={project.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Images className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-foreground truncate" title={project.name}>{project.name}</h3>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{format(new Date(project.createdAt), 'MMM d, yyyy')}</span>
                        <div className="flex gap-2">
                          <span className="flex items-center gap-1"><Images className="w-3 h-3"/> {project.imageCount}</span>
                          <span className="flex items-center gap-1"><PenLine className="w-3 h-3"/> {project.adCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
