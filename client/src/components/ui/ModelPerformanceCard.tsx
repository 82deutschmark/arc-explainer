/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-24
 * PURPOSE: Reusable model performance card component extracted from EloVoteResultsModal.tsx
 * Displays model statistics including accuracy, correct predictions, and optional ELO changes
 * Uses shadcn/ui Card components for consistent styling across the application
 * SRP and DRY check: Pass - Single responsibility of displaying model performance stats, reuses existing Card components
 */

import { Card, CardContent, CardHeader, CardTitle } from "./card"

interface ModelAccuracy {
  accuracyPercentage: number
  correctPredictions: number
  totalAttempts: number
}

interface ModelPerformanceCardProps {
  modelName: string
  accuracy?: ModelAccuracy
  eloChange?: number
  variant?: 'blue' | 'purple' | 'default'
  className?: string
}

export function ModelPerformanceCard({
  modelName,
  accuracy,
  eloChange,
  variant = 'default',
  className
}: ModelPerformanceCardProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'blue':
        return {
          card: 'bg-blue-50',
          title: 'text-blue-900',
          stats: 'text-blue-800'
        }
      case 'purple':
        return {
          card: 'bg-purple-50',
          title: 'text-purple-900',
          stats: 'text-purple-800'
        }
      default:
        return {
          card: 'bg-muted/50',
          title: 'text-foreground',
          stats: 'text-muted-foreground'
        }
    }
  }

  const classes = getVariantClasses()

  return (
    <Card className={`${classes.card} ${className || ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-base font-medium ${classes.title}`}>
          {modelName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {accuracy ? (
          <div className={`space-y-1 text-sm ${classes.stats}`}>
            <p>Overall Accuracy: {accuracy.accuracyPercentage.toFixed(1)}%</p>
            <p>Correct: {accuracy.correctPredictions}/{accuracy.totalAttempts}</p>
            {eloChange !== undefined && (
              <p>ELO Change: {eloChange > 0 ? '+' : ''}{eloChange}</p>
            )}
          </div>
        ) : (
          <p className={`text-sm ${classes.stats}`}>Performance data not available</p>
        )}
      </CardContent>
    </Card>
  )
}