/**
 * Author: Cascade using GPT-4
 * Date: 2025-10-10
 * PURPOSE: Renders the results of a two-model comparison on a dataset.
 * SRP and DRY check: Pass - This component has the single responsibility of displaying comparison results.
 * shadcn/ui: Pass - This component will use shadcn/ui components like Card, Table, and Badge.
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ModelComparisonResult, PuzzleComparisonDetail } from '@/pages/AnalyticsOverview';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface ModelComparisonResultsProps {
  result: ModelComparisonResult;
}

const getResultIcon = (result: 'correct' | 'incorrect' | 'not_attempted') => {
  switch (result) {
    case 'correct':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'incorrect':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'not_attempted':
      return <HelpCircle className="h-5 w-5 text-gray-400" />;
    default:
      return null;
  }
};

export const ModelComparisonResults: React.FC<ModelComparisonResultsProps> = ({ result }) => {
  if (!result) return null;

  const { summary, details } = result;
  const activeModels = [summary.model1Name, summary.model2Name, summary.model3Name, summary.model4Name].filter(Boolean);
  const modelCount = activeModels.length;

  // Helper function to get result icon
  const getResultIcon = (result: 'correct' | 'incorrect' | 'not_attempted') => {
    switch (result) {
      case 'correct':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'incorrect':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'not_attempted':
        return <HelpCircle className="h-5 w-5 text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <Card>
        <CardHeader>
            <CardTitle>Model Comparison: {activeModels.join(' vs ')} on {summary.dataset}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* Summary Cards */}
            <div className={`grid gap-4 ${modelCount <= 2 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'}">
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.allCorrect}</div>
                        <p className="text-sm text-muted-foreground">All Correct</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.allIncorrect}</div>
                        <p className="text-sm text-muted-foreground">All Incorrect</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.allNotAttempted}</div>
                        <p className="text-sm text-muted-foreground">All Not Attempted</p>
                    </CardContent>
                </Card>
                {summary.threeCorrect !== undefined && (
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold">{summary.threeCorrect}</div>
                            <p className="text-sm text-muted-foreground">3 Correct</p>
                        </CardContent>
                    </Card>
                )}
                {summary.twoCorrect !== undefined && (
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold">{summary.twoCorrect}</div>
                            <p className="text-sm text-muted-foreground">2 Correct</p>
                        </CardContent>
                    </Card>
                )}
                {summary.oneCorrect !== undefined && (
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold">{summary.oneCorrect}</div>
                            <p className="text-sm text-muted-foreground">1 Correct</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Model-specific stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {summary.model1OnlyCorrect > 0 && (
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                            <div className="text-lg font-bold text-blue-700">{summary.model1OnlyCorrect}</div>
                            <p className="text-sm text-blue-600">{summary.model1Name} Only</p>
                        </CardContent>
                    </Card>
                )}
                {summary.model2OnlyCorrect > 0 && (
                    <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                            <div className="text-lg font-bold text-green-700">{summary.model2OnlyCorrect}</div>
                            <p className="text-sm text-green-600">{summary.model2Name} Only</p>
                        </CardContent>
                    </Card>
                )}
                {summary.model3OnlyCorrect !== undefined && summary.model3OnlyCorrect > 0 && (
                    <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="p-4">
                            <div className="text-lg font-bold text-purple-700">{summary.model3OnlyCorrect}</div>
                            <p className="text-sm text-purple-600">{summary.model3Name} Only</p>
                        </CardContent>
                    </Card>
                )}
                {summary.model4OnlyCorrect !== undefined && summary.model4OnlyCorrect > 0 && (
                    <Card className="bg-orange-50 border-orange-200">
                        <CardContent className="p-4">
                            <div className="text-lg font-bold text-orange-700">{summary.model4OnlyCorrect}</div>
                            <p className="text-sm text-orange-600">{summary.model4Name} Only</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Details Table */}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Puzzle ID</TableHead>
                            {activeModels.map((model, index) => (
                                <TableHead key={index} className="text-center">{model}</TableHead>
                            ))}
                            <TableHead className="text-center">Agreement</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {details.map((detail) => (
                            <TableRow key={detail.puzzleId}>
                                <TableCell>{detail.puzzleId}</TableCell>
                                <TableCell className="text-center">{getResultIcon(detail.model1Result)}</TableCell>
                                <TableCell className="text-center">{getResultIcon(detail.model2Result)}</TableCell>
                                {detail.model3Result !== undefined && (
                                    <TableCell className="text-center">{getResultIcon(detail.model3Result)}</TableCell>
                                )}
                                {detail.model4Result !== undefined && (
                                    <TableCell className="text-center">{getResultIcon(detail.model4Result)}</TableCell>
                                )}
                                <TableCell className="text-center">
                                    {(() => {
                                        const results = [detail.model1Result, detail.model2Result, detail.model3Result, detail.model4Result].filter(Boolean);
                                        const correctCount = results.filter(r => r === 'correct').length;
                                        const incorrectCount = results.filter(r => r === 'incorrect').length;
                                        const notAttemptedCount = results.filter(r => r === 'not_attempted').length;
                                        
                                        if (correctCount === modelCount) return <Badge>All Correct</Badge>;
                                        if (incorrectCount === modelCount) return <Badge variant="destructive">All Wrong</Badge>;
                                        if (notAttemptedCount === modelCount) return <Badge variant="secondary">All Untried</Badge>;
                                        if (correctCount > incorrectCount) return <Badge variant="outline">Mostly Correct</Badge>;
                                        return <Badge variant="outline">Mixed</Badge>;
                                    })()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
  );
};
