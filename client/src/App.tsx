import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import PuzzleSolver from "@/pages/PuzzleSolver";
import PuzzleBrowser from "@/pages/PuzzleBrowser";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PuzzleBrowser} />
      <Route path="/puzzle/:taskId" component={PuzzleSolver} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
