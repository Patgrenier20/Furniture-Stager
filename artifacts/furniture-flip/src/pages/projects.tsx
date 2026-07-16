import { useState } from "react";
import { Link } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Images, PenLine } from "lucide-react";
import { format } from "date-fns";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const [search, setSearch] = useState("");

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">My Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your furniture flips.</p>
          </div>
          <Link href="/projects/new">
            <Button size="lg" className="rounded-xl shadow-sm">
              <Plus className="w-5 h-5 mr-2" /> New Project
            </Button>
          </Link>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search projects..." 
            className="pl-9 bg-card"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="animate-pulse bg-card h-72 rounded-2xl border border-border"></div>
            ))}
          </div>
        ) : filteredProjects?.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border border-dashed rounded-2xl">
            <Images className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-6">
              {search ? "No projects match your search." : "You haven't created any projects yet."}
            </p>
            {!search && (
              <Link href="/projects/new">
                <Button>Create a Project</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProjects?.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="group block">
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex flex-col h-full">
                  <div className="aspect-square bg-muted relative overflow-hidden shrink-0">
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
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-foreground line-clamp-1" title={project.name}>{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
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
    </DashboardLayout>
  );
}
