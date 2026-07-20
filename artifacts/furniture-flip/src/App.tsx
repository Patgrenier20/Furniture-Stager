import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';

// Split each page into its own chunk so the login route does not execute the
// dashboard, image editor, project studio, and landing page during its LCP.
const Landing = lazy(() => import('@/pages/landing'));
const Login = lazy(() => import('@/pages/login'));
const Register = lazy(() => import('@/pages/register'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const Projects = lazy(() => import('@/pages/projects'));
const NewProject = lazy(() => import('@/pages/new-project'));
const Studio = lazy(() => import('@/pages/studio'));
const Pricing = lazy(() => import('@/pages/pricing'));
const Account = lazy(() => import('@/pages/account'));
const JourneyPreview = lazy(() => import('@/pages/journey-preview'));
const NotFound = lazy(() => import('@/pages/not-found'));
const Toaster = lazy(() =>
  import('@/components/ui/toaster').then((module) => ({
    default: module.Toaster,
  })),
);

const queryClient = new QueryClient();

/**
 * Toasts are interaction feedback, so their Radix UI implementation is not
 * needed during the critical first paint. Loading it when the browser is idle
 * keeps that work out of the LCP window while preserving queued toast events.
 */
function DeferredToaster() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const callbackId = window.requestIdleCallback(
        () => setShouldRender(true),
        { timeout: 2_000 },
      );

      return () => window.cancelIdleCallback(callbackId);
    }

    const timeoutId = setTimeout(() => setShouldRender(true), 1_000);
    return () => clearTimeout(timeoutId);
  }, []);

  if (!shouldRender) return null;

  return (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/new" component={NewProject} />
      <Route path="/projects/:id" component={Studio} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/account" component={Account} />
      <Route path="/journey-preview" component={JourneyPreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Suspense fallback={<div className="min-h-dvh bg-background" />}>
          <Router />
        </Suspense>
      </WouterRouter>
      <DeferredToaster />
    </QueryClientProvider>
  );
}

export default App;
