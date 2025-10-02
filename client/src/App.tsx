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
import AnalyticsOverview from "@/pages/AnalyticsOverview";
import PuzzleDiscussion from "@/pages/PuzzleDiscussion";
import SaturnVisualSolver from "@/pages/SaturnVisualSolver";
import KaggleReadinessValidation from "@/pages/KaggleReadinessValidation";
import PuzzleDBViewer from "@/pages/PuzzleDBViewer";
import ModelBrowser from "@/pages/ModelBrowser";
import ModelManagement from "@/pages/ModelManagement";
import AdminHub from "@/pages/AdminHub";
import HuggingFaceIngestion from "@/pages/HuggingFaceIngestion";
import EloComparison from "@/pages/EloComparison";
import EloLeaderboard from "@/pages/EloLeaderboard";
import PuzzleFeedback from "@/pages/PuzzleFeedback";
import ModelDebate from "@/pages/ModelDebate";
import About from "@/pages/About";

function Router() {
  return (
    <PageLayout>
      <Switch>
        <Route path="/" component={PuzzleBrowser} />
        <Route path="/browser" component={PuzzleBrowser} />
        <Route path="/discussion" component={PuzzleDiscussion} />
        <Route path="/analytics" component={AnalyticsOverview} />

        <Route path="/kaggle-readiness" component={KaggleReadinessValidation} />
        <Route path="/puzzle/saturn/:taskId" component={SaturnVisualSolver} />
        <Route path="/puzzles/database" component={PuzzleDBViewer} />
        <Route path="/models" component={ModelBrowser} />
        <Route path="/model-config" component={ModelManagement} />

        {/* Admin routes */}
        <Route path="/admin" component={AdminHub} />
        <Route path="/admin/models" component={ModelManagement} />
        <Route path="/admin/ingest-hf" component={HuggingFaceIngestion} />

        <Route path="/elo" component={EloComparison} />
        <Route path="/elo/leaderboard" component={EloLeaderboard} />
        <Route path="/elo/:taskId" component={EloComparison} />
        <Route path="/compare" component={EloComparison} />
        <Route path="/compare/:taskId" component={EloComparison} />
        <Route path="/feedback" component={PuzzleFeedback} />
        <Route path="/feedback/:taskId" component={PuzzleFeedback} />
        <Route path="/debate" component={ModelDebate} />
        <Route path="/debate/:taskId" component={ModelDebate} />
        <Route path="/about" component={About} />
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
