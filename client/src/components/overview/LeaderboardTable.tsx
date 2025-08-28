/**
 * LeaderboardTable Component
 * 
 * A reusable component to display leaderboard data in a table format.
 * It is designed to be generic and can be used for various leaderboards.
 * 
 * @author Gemini 2.5 Pro
 * @date 2025-08-28
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface LeaderboardData {
  modelName: string;
  avgTrustworthiness: number;
  totalAttempts: number;
  avgConfidence: number;
  calibrationError: number;
  [key: string]: any; // Allow other properties
}

interface LeaderboardTableProps {
  title: string;
  data: LeaderboardData[];
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ title, data }) => {
  if (!data || data.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p>No data available.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Rank</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Avg. Trust</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Avg. Confidence</TableHead>
              <TableHead className="text-right">Calibration Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={item.modelName}>
                <TableCell>
                  <Badge variant={index < 3 ? 'default' : 'secondary'}>{index + 1}</Badge>
                </TableCell>
                <TableCell className="font-medium">{item.modelName}</TableCell>
                <TableCell className="text-right">{(item.avgTrustworthiness * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right">{item.totalAttempts}</TableCell>
                <TableCell className="text-right">{item.avgConfidence.toFixed(1)}%</TableCell>
                <TableCell className="text-right">{item.calibrationError.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LeaderboardTable;
