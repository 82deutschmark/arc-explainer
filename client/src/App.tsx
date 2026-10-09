/*
Author: GPT-6 Sol / Codex
Date: 2026-10-09
PURPOSE: Client-side router for ARC Explainer. Centralizes route registrations across all
         feature areas (puzzles, streaming, admin tools, ARC3 community, RE-ARC, Worm Arena),
         including ARC3 review tooling and supporting newspaper people, community and method routes.
         Loads secondary route modules on demand so the front page does not download
         every solver, replay viewer, editor and admin screen before becoming usable.
         ARC Daily news and competitor notebooks are separate lazy routes.
         Codex: /feedback loads the standalone audit; explanation comments retain their own route.
         2026-08-28: "/" now redirects to the ARC-AGI-3 community game gallery, which is
         the front door for the synthetic-game playtest programme (see
         docs/28-Aug-2026-synthetic-games-arc3-integration-plan.md). The resource
         directory lives at "/home" and is linked from the header.
         2026-10-05 (Claude Opus 5.5): /kaggle-leaderboard, the public Kaggle board page.
SRP/DRY check: Pass - kept as a routing table only; reuses the existing wouter Redirect
         component already used by the legacy /arc3/archive routes.
*/

import { lazy, Suspense } from "react";
import { Switch, Route, useParams } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageLayout } from "@/components/layout/PageLayout";
import RouteLoadBoundary from "@/components/RouteLoadBoundary";
import RouteMetadata from "@/components/RouteMetadata";
import DynamicFavicon from "@/components/DynamicFavicon";
import NotFound from "@/pages/not-found";
import Redirect from "@/components/Redirect";
import SyntheticLanding from "@/pages/arc3-community/SyntheticLanding";

// Keep the current front door eager. Secondary pages are separate chunks; importing
// concrete page files also avoids pulling every page from a feature barrel at once.
const PuzzleExaminer = lazy(() => import("@/pages/PuzzleExaminer"));
const PuzzleAnalyst = lazy(() => import("@/pages/PuzzleAnalyst"));
const PuzzleBrowser = lazy(() => import("@/pages/PuzzleBrowser"));
const AnalyticsOverview = lazy(() => import("@/pages/AnalyticsOverview"));
const Leaderboards = lazy(() => import("@/pages/Leaderboards"));
const KaggleLeaderboard = lazy(() => import("@/pages/KaggleLeaderboard"));
const News = lazy(() => import("@/pages/News"));
const NewsPeople = lazy(() => import("@/pages/NewsPeople"));
const NewsCommunity = lazy(() => import("@/pages/NewsCommunity"));
const NewsMethod = lazy(() => import("@/pages/NewsMethod"));
const NewsArticle = lazy(() => import("@/pages/NewsArticle"));
const NewsCompetitors = lazy(() => import("@/pages/NewsCompetitors"));
const NewsCompetitor = lazy(() => import("@/pages/NewsCompetitor"));
const PuzzleDiscussion = lazy(() => import("@/pages/PuzzleDiscussion"));
const SaturnVisualSolver = lazy(() => import("@/pages/SaturnVisualSolver"));
const GroverSolver = lazy(() => import("@/pages/GroverSolver"));
const PoetiqSolver = lazy(() => import("@/pages/PoetiqSolver"));
const BeetreeSolver = lazy(() => import("@/pages/BeetreeSolver"));
const PoetiqCommunity = lazy(() => import("@/pages/PoetiqCommunity"));
const KaggleReadinessValidation = lazy(() => import("@/pages/KaggleReadinessValidation"));
const PuzzleDBViewer = lazy(() => import("@/pages/PuzzleDBViewer"));
const ModelBrowser = lazy(() => import("@/pages/ModelBrowser"));
const ModelManagement = lazy(() => import("@/pages/ModelManagement"));
const AdminHub = lazy(() => import("@/pages/AdminHub"));
const HuggingFaceIngestion = lazy(() => import("@/pages/HuggingFaceIngestion"));
const AdminOpenRouter = lazy(() => import("@/pages/AdminOpenRouter"));
const EloComparison = lazy(() => import("@/pages/EloComparison"));
const EloLeaderboard = lazy(() => import("@/pages/EloLeaderboard"));
const PuzzleFeedback = lazy(() => import("@/pages/PuzzleFeedback"));
const FeedbackExplorer = lazy(() => import("@/pages/FeedbackExplorer"));
const ModelDebate = lazy(() => import("@/pages/ModelDebate"));
const LLMCouncil = lazy(() => import("@/pages/LLMCouncil"));
const ModelComparisonPage = lazy(() => import("@/pages/ModelComparisonPage"));
const HuggingFaceUnionAccuracy = lazy(() => import("@/pages/HuggingFaceUnionAccuracy"));
const About = lazy(() => import("@/pages/About"));
const ClaudeCodeGuide = lazy(() => import("@/pages/ClaudeCodeGuide"));
const ARC3AgentPlayground = lazy(() => import("@/pages/ARC3AgentPlayground"));
const Arc3GameSpoiler = lazy(() => import("@/pages/Arc3GameSpoiler"));
const Arc3Story = lazy(() => import("@/pages/Arc3Story"));
const PuzzleTradingCards = lazy(() => import("@/pages/PuzzleTradingCards"));
const HumanTradingCards = lazy(() => import("@/pages/HumanTradingCards"));
const JohanLandTribute = lazy(() => import("@/pages/JohanLandTribute"));
const LLMReasoning = lazy(() => import("@/pages/LLMReasoning"));
const LLMReasoningAdvanced = lazy(() => import("@/pages/LLMReasoningAdvanced"));
const SnakeBenchEmbed = lazy(() => import("@/pages/SnakeBenchEmbed"));
const WormArena = lazy(() => import("@/pages/WormArena"));
const WormArenaLive = lazy(() => import("@/pages/WormArenaLive"));
const WormArenaStats = lazy(() => import("@/pages/WormArenaStats"));
const WormArenaMatches = lazy(() => import("@/pages/WormArenaMatches"));
const WormArenaModels = lazy(() => import("@/pages/WormArenaModels"));
const WormArenaSkillAnalysis = lazy(() => import("@/pages/WormArenaSkillAnalysis"));
const WormArenaDistributions = lazy(() => import("@/pages/WormArenaDistributions"));
const WormArenaRules = lazy(() => import("@/pages/WormArenaRules"));
const ReArc = lazy(() => import("@/pages/ReArc"));
const ReArcDataset = lazy(() => import("@/pages/ReArcDataset"));
const ReArcSubmissions = lazy(() => import("@/pages/ReArcSubmissions"));
const TaskEfficiency = lazy(() => import("@/pages/TaskEfficiency"));
const DebateTaskRedirect = lazy(() => import("@/pages/DebateTaskRedirect"));
const ReArcErrorShowcase = import.meta.env.DEV
  ? lazy(() => import("@/pages/dev/ReArcErrorShowcase"))
  : undefined;
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Arc3Review = lazy(() => import("@/pages/arc3-community/Arc3Review"));
const Arc3HypothesisResearch = lazy(() => import("@/pages/arc3-community/Arc3HypothesisResearch"));
// Unlisted answer key: keep it absent from navigation, with its existing noindex policy.
const Arc3MechanicGuide = lazy(() => import("@/pages/arc3-community/Arc3MechanicGuide"));
// The official game index shares its registry with the server-rendered /arc3/games.md.
const Arc3GamesIndex = lazy(() => import("@/pages/Arc3GamesIndex"));
const Arc3SlipperySeven = lazy(() => import("@/pages/Arc3SlipperySeven"));
const Arc3ArchivePlayground = lazy(() => import("@/pages/arc3-archive/Arc3ArchivePlayground"));
const CommunityGallery = lazy(() => import("@/pages/arc3-community/CommunityGallery"));
const CommunityGamePlay = lazy(() => import("@/pages/arc3-community/CommunityGamePlay"));

function RouteLoading() {
  return (
    <div role="status" aria-live="polite" className="min-h-[50vh] px-6 py-12 text-sm text-muted-foreground">
      Loading page…
    </div>
  );
}

function LegacyArc3GameRedirect() {
  const params = useParams<{ gameId: string }>();
  const gameId = params.gameId ?? "";
  return <Redirect to={`/arc3/games/${gameId}`} />;
}

function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
    <Switch>
      <Route path="/feedback"><Redirect to="/feedback" fullPage /></Route>
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
          {/* Keep navigation visible while the selected page chunk loads. */}
          <Suspense fallback={<RouteLoading />}>
          <Switch>
        {/* Root is the landing page, on EVERY host. It used to depend on which host asked:
            arc3.markbarney.net got the landing, arc.markbarney.net redirected to
            /arc3/gallery. That was wrong twice over. A visitor to the main host was
            dropped into a wall of unlabelled thumbnails with nothing saying what the site
            is, and the two hosts disagreed about what "home" means, which is how the
            brand mark ended up as a second link to the gallery. One front door, one
            explanation, both hosts. /synthetic stays as an alias because it has been
            linked; the resource hub lives at /home. */}
        <Route path="/" component={SyntheticLanding} />
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
        <Route path="/kaggle-leaderboard/arc-2"><KaggleLeaderboard key="arc-2" competitionKey="arc-2" /></Route>
        <Route path="/kaggle-leaderboard"><KaggleLeaderboard key="arc-3" competitionKey="arc-3" /></Route>
        <Route path="/news" component={News} />
        <Route path="/news/competitors" component={NewsCompetitors} />
        <Route path="/news/competitors/:competitorId" component={NewsCompetitor} />
        <Route path="/news/people" component={NewsPeople} />
        <Route path="/news/people/:personId" component={NewsPeople} />
        <Route path="/news/community" component={NewsCommunity} />
        <Route path="/news/how-this-is-made" component={NewsMethod} />
        <Route path="/news/:articleId" component={NewsArticle} />

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
        <Route path="/explanation-feedback" component={FeedbackExplorer} />
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
        <Route path="/arc3/games" component={Arc3GamesIndex} />
        <Route path="/arc3/slippery-seven" component={Arc3SlipperySeven} />
        <Route path="/arc3/games/:gameId" component={Arc3GameSpoiler} />
        {/* ARC3 Community - game play, gallery, uploads (secondary) */}
        <Route path="/arc3/playground" component={ARC3AgentPlayground} />
        <Route path="/arc3/gallery" component={CommunityGallery} />
        {/* Written up for readers outside the project: what a local model guesses about one
            unseen frame, and what LM Studio's thinking controls actually do. */}
        <Route path="/arc3/hypotheses" component={Arc3HypothesisResearch} />
        <Route path="/arc3/mechanics" component={Arc3MechanicGuide} />
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
        {import.meta.env.DEV && ReArcErrorShowcase && (
          <>
            <Route path="/dev/re-arc/error-display" component={ReArcErrorShowcase} />
          </>
        )}

            <Route component={NotFound} />
          </Switch>
          </Suspense>
        </PageLayout>
      </Route>
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <DynamicFavicon randomize={true} />
        <RouteMetadata />
        <RouteLoadBoundary><Router /></RouteLoadBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
