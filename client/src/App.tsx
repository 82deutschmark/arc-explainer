/*
Author: Cascade (ChatGPT) / Claude Opus 5
Date: 2026-02-10 / 2026-08-28
PURPOSE: Client-side router for ARC Explainer. Centralizes route registrations across all
         feature areas (puzzles, streaming, admin tools, ARC3 community, RE-ARC, Worm Arena),
         including ARC3 community submission review tooling under the admin section.
         2026-08-28: "/" now redirects to the ARC-AGI-3 community game gallery, which is
         the front door for the synthetic-game playtest programme (see
         docs/28-Aug-2026-synthetic-games-arc3-integration-plan.md). The previous resource-hub
         landing page is preserved verbatim at "/home" and is still linked from the header.
SRP/DRY check: Pass - kept as a routing table only; reuses the existing wouter Redirect
         component already used by the legacy /arc3/archive routes.
*/

import { Switch, Route, useParams } from "wouter";
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
import ClaudeCodeGuide from "@/pages/ClaudeCodeGuide";
import ARC3AgentPlayground from "@/pages/ARC3AgentPlayground";
import Arc3GameSpoiler from "@/pages/Arc3GameSpoiler";
import Arc3Story from "@/pages/Arc3Story";
import { 
  Arc3ArchiveLanding, 
  Arc3ArchivePlayground 
} from "@/pages/arc3-archive";
import {
  CommunityGallery,
  CommunityGamePlay,
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
import SyntheticLanding from "@/pages/arc3-community/SyntheticLanding";
import Arc3Review from "@/pages/arc3-community/Arc3Review";
import Arc3HypothesisResearch from "@/pages/arc3-community/Arc3HypothesisResearch";

function LegacyArc3GameRedirect() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? "";
  return <Redirect to={`/arc3/games/${gameId}`} />;
}

/** Hosts that lead with the synthetic-programme landing rather than the task grid. */
const SYNTHETIC_HOSTS = new Set(["arc3.markbarney.net", "arc3.localhost"]);

function RootLanding() {
  // Read at render rather than module load so a dev preview reflects the real hostname.
  const host = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  if (SYNTHETIC_HOSTS.has(host) || new URLSearchParams(window.location.search).has("synthetic")) {
    return <SyntheticLanding />;
  }
  return <Redirect to="/arc3/gallery" />;
}

function Router() {
  return (
    <Switch>
      {/* The play surface is deliberately OUTSIDE PageLayout. PageLayout renders
          AppHeader on every route, and the play page has its own minimal bar, so
          routing it inside stacked two nav bars on top of every game. A task should
          own the whole viewport the way the official ARC-AGI-3 player does. */}
      <Route path="/arc3/play/:gameId" component={CommunityGamePlay} />
      {/* Outside PageLayout for the same reason: it resolves straight into a task, and a
          nav bar flashing on the way through is noise.

          /play is the short one and the one to hand to a person -- it is the whole point of
          the site, so it should not be three segments deep. /arc3/review is kept as an
          alias because it has been shared and bookmarked; it is the same component, not a
          redirect, so neither URL is second-class. */}
      <Route path="/play" component={Arc3Review} />
      <Route path="/arc3/review" component={Arc3Review} />
      <Route>
        <PageLayout>
          <Switch>
        {/* Root depends on which host asked.

            arc3.markbarney.net is the public face of the synthetic-task programme, so it
            gets a real landing page -- what this is in plain language, a task that needs
            coverage, the methodology, and how researchers contribute -- rather than being
            bounced straight into a grid with no context.

            On the main host the gallery is the front door, because a visitor there has
            already arrived somewhere that explains itself. The resource hub is unchanged
            at /home in both cases. */}
        <Route path="/" component={RootLanding} />
        <Route path="/synthetic" component={SyntheticLanding} />
        <Route path="/home" component={LandingPage} />
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
        <Route path="/cc" component={ClaudeCodeGuide} />
        <Route path="/llm-reasoning" component={LLMReasoning} />
        <Route path="/llm-reasoning/advanced" component={LLMReasoningAdvanced} />
        {/* ARC3 - Story & explainer page (primary landing) */}
        <Route path="/arc3" component={Arc3Story} />
        <Route path="/arc3/games/:gameId" component={Arc3GameSpoiler} />
        {/* ARC3 Community - game play, gallery, uploads (secondary) */}
        <Route path="/arc3/playground" component={ARC3AgentPlayground} />
        <Route path="/arc3/gallery" component={CommunityGallery} />
        {/* Written up for readers outside the project: what a local model guesses about one
            unseen frame, and what LM Studio's thinking controls actually do. */}
        <Route path="/arc3/hypotheses" component={Arc3HypothesisResearch} />
        {/* /arc3/upload removed 2026-08-30: task submissions belong to
            arc3.sonpham.net, the source of truth for the synthetic set. */}
        {/* Legacy archive routes - redirect to new structure */}
        <Route path="/arc3/archive" component={() => <Redirect to="/arc3" />} />
        <Route path="/arc3/archive/games" component={() => <Redirect to="/arc3" />} />
        <Route path="/arc3/archive/games/:gameId" component={LegacyArc3GameRedirect} />
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
      </Route>
    </Switch>
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
