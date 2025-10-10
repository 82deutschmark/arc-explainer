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

  return (
    <Card>
        <CardHeader>
            <CardTitle>Model Comparison: {summary.model1Name} vs. {summary.model2Name} on {summary.dataset}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.bothCorrect}</div>
                        <p className="text-sm text-muted-foreground">Both Correct</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.model1OnlyCorrect}</div>
                        <p className="text-sm text-muted-foreground">{summary.model1Name} Only</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.model2OnlyCorrect}</div>
                        <p className="text-sm text-muted-foreground">{summary.model2Name} Only</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.bothIncorrect}</div>
                        <p className="text-sm text-muted-foreground">Both Incorrect</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="text-2xl font-bold">{summary.totalPuzzles}</div>
                        <p className="text-sm text-muted-foreground">Total Puzzles</p>
                    </CardContent>
                </Card>
            </div>

            {/* Details Table */}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Puzzle ID</TableHead>
                            <TableHead className="text-center">{summary.model1Name}</TableHead>
                            <TableHead className="text-center">{summary.model2Name}</TableHead>
                            <TableHead className="text-center">Agreement</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {details.map((detail) => (
                            <TableRow key={detail.puzzleId}>
                                <TableCell>{detail.puzzleId}</TableCell>
                                <TableCell className="text-center">{getResultIcon(detail.model1Result)}</TableCell>
                                <TableCell className="text-center">{getResultIcon(detail.model2Result)}</TableCell>
                                <TableCell className="text-center">
                                    {detail.model1Result === detail.model2Result ? (
                                        <Badge variant="secondary">Agree</Badge>
                                    ) : (
                                        <Badge variant="outline">Disagree</Badge>
                                    )}
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
