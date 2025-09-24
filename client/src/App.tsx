import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageLayout } from "@/components/layout/PageLayout";
import DynamicFavicon from "@/components/DynamicFavicon";
import NotFound from "@/pages/not-found";
import PuzzleExaminer from "@/pages/PuzzleExaminer";
import PuzzleBrowser from "@/pages/PuzzleBrowser";
import PuzzleOverview from "@/pages/PuzzleOverview";
import AnalyticsOverview from "@/pages/AnalyticsOverview";
import PuzzleDiscussion from "@/pages/PuzzleDiscussion";
import SaturnVisualSolver from "@/pages/SaturnVisualSolver";
import BatchResults from "@/pages/BatchResults";
import KaggleReadinessValidation from "@/pages/KaggleReadinessValidation";
import PuzzleDBViewer from "@/pages/PuzzleDBViewer";
import ModelBrowser from "@/pages/ModelBrowser";
import EloComparison from "@/pages/EloComparison";
import EloLeaderboard from "@/pages/EloLeaderboard";

function Router() {
  return (
    <PageLayout>
      <Switch>
        <Route path="/" component={PuzzleBrowser} />
        <Route path="/browser" component={PuzzleBrowser} />
        <Route path="/discussion" component={PuzzleDiscussion} />
        <Route path="/overview" component={PuzzleOverview} />
        <Route path="/analytics" component={AnalyticsOverview} />
        <Route path="/batch" component={BatchResults} />
        <Route path="/kaggle-readiness" component={KaggleReadinessValidation} />
        <Route path="/puzzle/saturn/:taskId" component={SaturnVisualSolver} />
        <Route path="/puzzles/database" component={PuzzleDBViewer} />
        <Route path="/models" component={ModelBrowser} />
        <Route path="/elo" component={EloComparison} />
        <Route path="/elo/leaderboard" component={EloLeaderboard} />
        <Route path="/elo/:taskId" component={EloComparison} />
        <Route path="/compare" component={EloComparison} />
        <Route path="/compare/:taskId" component={EloComparison} />
        <Route path="/puzzle/:taskId" component={PuzzleExaminer} />
        <Route path="/examine/:taskId" component={PuzzleExaminer} />
        <Route component={NotFound} />
      </Switch>
    </PageLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <DynamicFavicon randomize={true} />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
