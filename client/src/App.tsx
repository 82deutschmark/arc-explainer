import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import PuzzleExaminer from "@/pages/PuzzleExaminer";
import PuzzleBrowser from "@/pages/PuzzleBrowser";
import PuzzleOverview from "@/pages/PuzzleOverview";
import SaturnVisualSolver from "@/pages/SaturnVisualSolver";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PuzzleBrowser} />
      <Route path="/overview" component={PuzzleOverview} />
      <Route path="/puzzle/saturn/:taskId" component={SaturnVisualSolver} />
      <Route path="/puzzle/:taskId" component={PuzzleExaminer} />
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
