/**
 * Author: Cascade using Claude 3.5 Sonnet (improved responsiveness)
 * Date: 2025-09-27T12:35:19-04:00
 * PURPOSE: Enhanced LeaderboardTable with improved responsive design
 * 
 * A reusable component to display leaderboard data in a table format with better mobile support.
 * It is designed to be generic and can be used for various leaderboards.
 * 
 * FIXED: Improved responsive table layout, better text wrapping, and mobile-friendly design
 * SRP and DRY check: Pass - Single responsibility for tabular leaderboard display
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
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Rank</TableHead>
              <TableHead className="min-w-[120px]">Model</TableHead>
              <TableHead className="text-right whitespace-nowrap">Avg. Trust</TableHead>
              <TableHead className="text-right whitespace-nowrap">Attempts</TableHead>
              <TableHead className="text-right whitespace-nowrap hidden sm:table-cell">Avg. Confidence</TableHead>
              <TableHead className="text-right whitespace-nowrap hidden md:table-cell">Calibration Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={item.modelName}>
                <TableCell>
                  <Badge variant={index < 3 ? 'default' : 'secondary'}>{index + 1}</Badge>
                </TableCell>
                <TableCell className="font-medium truncate max-w-[120px]" title={item.modelName}>{item.modelName}</TableCell>
                <TableCell className="text-right">{(item.avgTrustworthiness * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-right">{item.totalAttempts}</TableCell>
                <TableCell className="text-right hidden sm:table-cell">{item.avgConfidence.toFixed(1)}%</TableCell>
                <TableCell className="text-right hidden md:table-cell">{item.calibrationError.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LeaderboardTable;
