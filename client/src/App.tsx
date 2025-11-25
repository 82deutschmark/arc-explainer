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
import Leaderboards from "@/pages/Leaderboards";
import PuzzleDiscussion from "@/pages/PuzzleDiscussion";
import SaturnVisualSolver from "@/pages/SaturnVisualSolver";
import GroverSolver from "@/pages/GroverSolver";
import PoetiqSolver from "@/pages/PoetiqSolver";
import KaggleReadinessValidation from "@/pages/KaggleReadinessValidation";
import PuzzleDBViewer from "@/pages/PuzzleDBViewer";
import ModelBrowser from "@/pages/ModelBrowser";
import ModelManagement from "@/pages/ModelManagement";
import AdminHub from "@/pages/AdminHub";
import HuggingFaceIngestion from "@/pages/HuggingFaceIngestion";
import EloComparison from "@/pages/EloComparison";
import EloLeaderboard from "@/pages/EloLeaderboard";
import PuzzleFeedback from "@/pages/PuzzleFeedback";
import FeedbackExplorer from "@/pages/FeedbackExplorer";
import ModelDebate from "@/pages/ModelDebate";
import ModelComparisonPage from "@/pages/ModelComparisonPage";
import HuggingFaceUnionAccuracy from "@/pages/HuggingFaceUnionAccuracy";
import About from "@/pages/About";
import ARC3Browser from "@/pages/ARC3Browser";
import ARC3AgentPlayground from "@/pages/ARC3AgentPlayground";
import PuzzleTradingCards from "@/pages/PuzzleTradingCards";
import HumanTradingCards from "@/pages/HumanTradingCards";
import LLMReasoning from "@/pages/LLMReasoning";
import LLMReasoningAdvanced from "@/pages/LLMReasoningAdvanced";
import Redirect from "@/components/Redirect";

function Router() {
  return (
    <PageLayout>
      <Switch>
        <Route path="/" component={PuzzleBrowser} />
        <Route path="/browser" component={PuzzleBrowser} />
        <Route path="/trading-cards" component={PuzzleTradingCards} />
        <Route path="/hall-of-fame" component={HumanTradingCards} />
        <Route path="/human-cards" component={() => <Redirect to="/hall-of-fame" />} />
        <Route path="/discussion" component={PuzzleDiscussion} />
        <Route path="/discussion/:taskId" component={PuzzleDiscussion} />
        <Route path="/analytics" component={AnalyticsOverview} />
        <Route path="/leaderboards" component={Leaderboards} />

        <Route path="/kaggle-readiness" component={KaggleReadinessValidation} />
        <Route path="/puzzle/saturn/:taskId" component={SaturnVisualSolver} />
        <Route path="/puzzle/grover/:taskId" component={GroverSolver} />
        <Route path="/puzzle/poetiq/:taskId" component={PoetiqSolver} />
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
        <Route path="/feedback" component={FeedbackExplorer} />
        <Route path="/test-solution" component={PuzzleFeedback} />
        <Route path="/test-solution/:taskId" component={PuzzleFeedback} />
        <Route path="/debate" component={ModelDebate} />
        <Route path="/debate/:taskId" component={ModelDebate} />
        <Route path="/model-comparison" component={ModelComparisonPage} />
        <Route path="/scoring" component={HuggingFaceUnionAccuracy} />
        <Route path="/about" component={About} />
        <Route path="/llm-reasoning" component={LLMReasoning} />
        <Route path="/llm-reasoning/advanced" component={LLMReasoningAdvanced} />
        <Route path="/arc3" component={ARC3Browser} />
        <Route path="/arc3/playground" component={ARC3AgentPlayground} />
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
