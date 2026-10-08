/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Give visitors useful recovery links for an unknown URL and keep its metadata unindexed.
 * SRP/DRY check: Pass — shared metadata hook owns browser head updates.
 */
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  usePageMeta({ title: 'Page not found | ARC Explainer', noindex: true });

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            This address does not match a page on ARC Explainer.
          </p>
          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/home" className="underline">Resource hub</Link>
            <Link href="/arc3/games" className="underline">Game guides</Link>
            <Link href="/kaggle-leaderboard" className="underline">Kaggle leaderboard</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
