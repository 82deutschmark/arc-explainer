/*
Author: GPT-5.2
Date: 2026-02-04
PURPOSE: Client-side router for ARC Explainer. Centralizes route registrations across all
         feature areas (puzzles, streaming, admin tools, ARC3 community, RE-ARC, Worm Arena),
         including ARC3 community submission review tooling under the admin section.
SRP/DRY check: Pass - kept as a routing table only and verified existing routes remain intact.
*/

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageLayout } from "@/components/layout/PageLayout";
import DynamicFavicon from "@/components/DynamicFavicon";
import NotFound from "@/pages/not-found";
import PuzzleExaminer from "@/pages/PuzzleExaminer";
import PuzzleAnalyst from "@/pages/PuzzleAnalyst";
import PuzzleBrowser from "@/pages/PuzzleBrowser";
import AnalyticsOverview from "@/pages/AnalyticsOverview";
import Leaderboards from "@/pages/Leaderboards";
import PuzzleDiscussion from "@/pages/PuzzleDiscussion";
import SaturnVisualSolver from "@/pages/SaturnVisualSolver";
import GroverSolver from "@/pages/GroverSolver";
import PoetiqSolver from "@/pages/PoetiqSolver";
import BeetreeSolver from "@/pages/BeetreeSolver";
import PoetiqCommunity from "@/pages/PoetiqCommunity";
import KaggleReadinessValidation from "@/pages/KaggleReadinessValidation";
import PuzzleDBViewer from "@/pages/PuzzleDBViewer";
import ModelBrowser from "@/pages/ModelBrowser";
import ModelManagement from "@/pages/ModelManagement";
import AdminHub from "@/pages/AdminHub";
import AdminArc3Submissions from "@/pages/AdminArc3Submissions";
import HuggingFaceIngestion from "@/pages/HuggingFaceIngestion";
import AdminOpenRouter from "@/pages/AdminOpenRouter";
import EloComparison from "@/pages/EloComparison";
import EloLeaderboard from "@/pages/EloLeaderboard";
import PuzzleFeedback from "@/pages/PuzzleFeedback";
import FeedbackExplorer from "@/pages/FeedbackExplorer";
import ModelDebate from "@/pages/ModelDebate";
import LLMCouncil from "@/pages/LLMCouncil";
import ModelComparisonPage from "@/pages/ModelComparisonPage";
import HuggingFaceUnionAccuracy from "@/pages/HuggingFaceUnionAccuracy";
import About from "@/pages/About";
import ARC3Browser from "@/pages/ARC3Browser";
import ARC3AgentPlayground from "@/pages/ARC3AgentPlayground";
import Arc3OpenRouterPlayground from "@/pages/Arc3OpenRouterPlayground";
import Arc3CodexPlayground from "@/pages/Arc3CodexPlayground";
import Arc3HaikuPlayground from "@/pages/Arc3HaikuPlayground";
import Arc3GamesBrowser from "@/pages/Arc3GamesBrowser";
import Arc3GameSpoiler from "@/pages/Arc3GameSpoiler";
import { 
  Arc3ArchiveLanding, 
  Arc3ArchiveGamesBrowser, 
  Arc3ArchiveGameSpoiler, 
  Arc3ArchivePlayground 
} from "@/pages/arc3-archive";
import {
  CommunityLanding,
  CommunityGallery,
  CommunityGamePlay,
  GameSubmissionPage,
} from "@/pages/arc3-community";
import PuzzleTradingCards from "@/pages/PuzzleTradingCards";
import HumanTradingCards from "@/pages/HumanTradingCards";
import JohanLandTribute from "@/pages/JohanLandTribute";
import LLMReasoning from "@/pages/LLMReasoning";
import LLMReasoningAdvanced from "@/pages/LLMReasoningAdvanced";
import SnakeBenchEmbed from "@/pages/SnakeBenchEmbed";
import WormArena from "@/pages/WormArena";
import WormArenaLive from "@/pages/WormArenaLive";
import WormArenaStats from "@/pages/WormArenaStats";
import WormArenaMatches from "@/pages/WormArenaMatches";
import WormArenaModels from "@/pages/WormArenaModels";
import WormArenaSkillAnalysis from "@/pages/WormArenaSkillAnalysis";
import WormArenaDistributions from "@/pages/WormArenaDistributions";
import WormArenaRules from "@/pages/WormArenaRules";
import ReArc from "@/pages/ReArc";
import ReArcDataset from "@/pages/ReArcDataset";
import ReArcSubmissions from "@/pages/ReArcSubmissions";
import TaskEfficiency from "@/pages/TaskEfficiency";
import Redirect from "@/components/Redirect";
import DebateTaskRedirect from "@/pages/DebateTaskRedirect";

import ReArcErrorShowcase from "@/pages/dev/ReArcErrorShowcase";
import LandingPage from "@/pages/LandingPage";

function Router() {
  return (
    <PageLayout>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/browser" component={PuzzleBrowser} />
        <Route path="/trading-cards" component={PuzzleTradingCards} />
        <Route path="/hall-of-fame" component={HumanTradingCards} />
        <Route path="/hall-of-fame/johan-land" component={JohanLandTribute} />
        <Route path="/human-cards" component={() => <Redirect to="/hall-of-fame" />} />
        <Route path="/discussion" component={PuzzleDiscussion} />
        <Route path="/discussion/:taskId" component={PuzzleDiscussion} />
        <Route path="/analytics" component={AnalyticsOverview} />
        <Route path="/leaderboards" component={Leaderboards} />

        <Route path="/kaggle-readiness" component={KaggleReadinessValidation} />
        <Route path="/puzzle/saturn/:taskId" component={SaturnVisualSolver} />
        <Route path="/puzzle/grover/:taskId" component={GroverSolver} />
        <Route path="/puzzle/beetree/:taskId?" component={BeetreeSolver} />
        <Route path="/poetiq" component={PoetiqCommunity} />
        <Route path="/puzzle/poetiq/:taskId" component={PoetiqSolver} />
        <Route path="/puzzles/database" component={PuzzleDBViewer} />
        <Route path="/models" component={ModelBrowser} />
        <Route path="/model-config" component={ModelManagement} />

        {/* Admin routes */}
        <Route path="/admin" component={AdminHub} />
        <Route path="/admin/models" component={ModelManagement} />
        <Route path="/admin/arc3-submissions" component={AdminArc3Submissions} />
        <Route path="/admin/ingest-hf" component={HuggingFaceIngestion} />
        <Route path="/admin/openrouter" component={AdminOpenRouter} />

        <Route path="/elo" component={EloComparison} />
        <Route path="/elo/leaderboard" component={EloLeaderboard} />
        <Route path="/elo/:taskId" component={EloComparison} />
        <Route path="/compare" component={EloComparison} />
        <Route path="/compare/:taskId" component={EloComparison} />
        <Route path="/feedback" component={FeedbackExplorer} />
        <Route path="/test-solution" component={PuzzleFeedback} />
        <Route path="/test-solution/:taskId" component={PuzzleFeedback} />
        <Route path="/debate" component={ModelDebate} />
        <Route path="/debate/:taskId" component={DebateTaskRedirect} />
        <Route path="/council" component={LLMCouncil} />
        <Route path="/council/:taskId" component={LLMCouncil} />
        <Route path="/model-comparison" component={ModelComparisonPage} />
        <Route path="/scoring" component={HuggingFaceUnionAccuracy} />
        <Route path="/about" component={About} />
        <Route path="/llm-reasoning" component={LLMReasoning} />
        <Route path="/llm-reasoning/advanced" component={LLMReasoningAdvanced} />
        {/* ARC3 Community - user-uploaded games platform (new main landing) */}
        <Route path="/arc3" component={CommunityLanding} />
        <Route path="/arc3/playground" component={ARC3AgentPlayground} />
        <Route path="/arc3/gallery" component={CommunityGallery} />
        <Route path="/arc3/play/:gameId" component={CommunityGamePlay} />
        <Route path="/arc3/upload" component={GameSubmissionPage} />
        {/* ARC3 Archive - historical preview content */}
        <Route path="/arc3/archive" component={Arc3ArchiveLanding} />
        <Route path="/arc3/archive/games" component={Arc3ArchiveGamesBrowser} />
        <Route path="/arc3/archive/games/:gameId" component={Arc3ArchiveGameSpoiler} />
        <Route path="/arc3/archive/playground" component={Arc3ArchivePlayground} />
        {/* RE-ARC - self-service dataset generation and evaluation */}
        <Route path="/re-arc" component={ReArc} />
        <Route path="/re-arc/submissions" component={ReArcSubmissions} />
        <Route path="/dataset-viewer" component={ReArcDataset} />
        {/* SnakeBench = official upstream project at snakebench.com */}
        <Route path="/snakebench" component={SnakeBenchEmbed} />
        {/* Backwards compatibility redirect */}
        <Route path="/snake-arena" component={() => <Redirect to="/worm-arena" />} />
        {/* Worm Arena = our local junior version with bring-your-own-key functionality */}
        <Route path="/worm-arena" component={WormArena} />
        <Route path="/worm-arena/live" component={WormArenaLive} />
        <Route path="/worm-arena/live/:sessionId" component={WormArenaLive} />
        <Route path="/worm-arena/matches" component={WormArenaMatches} />
        <Route path="/worm-arena/models" component={WormArenaModels} />
        <Route path="/worm-arena/stats" component={WormArenaStats} />
        <Route path="/worm-arena/skill-analysis" component={WormArenaSkillAnalysis} />
        <Route path="/worm-arena/distributions" component={WormArenaDistributions} />
        <Route path="/worm-arena/rules" component={WormArenaRules} />
        <Route path="/puzzle/:taskId" component={PuzzleExaminer} />
        <Route path="/examine/:taskId" component={PuzzleExaminer} />
        <Route path="/task/:taskId/efficiency" component={TaskEfficiency} />
        <Route path="/task/:taskId" component={PuzzleAnalyst} />

        {/* Dev-only routes for component showcases (excluded from production builds)
            See docs/reference/frontend/DEV_ROUTES.md for pattern guide */}
        {import.meta.env.DEV && (
          <>
            <Route path="/dev/re-arc/error-display" component={ReArcErrorShowcase} />
          </>
        )}

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
