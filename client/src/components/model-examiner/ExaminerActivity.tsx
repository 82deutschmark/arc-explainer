/**DEPRECATED!!!  NEEDS REMOVAL!!
 * ExaminerActivity.tsx
 *
 * @description Displays the live processing activity and result logs for a batch session.
 * @author Cascade
 */

import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, Eye } from 'lucide-react';

// Props Interface
interface ExaminerActivityProps {
  sessionId: string | null;
  startupStatus: string | null;
  progress: any; // Replace with a more specific type if available
  results: any[]; // Replace with a more specific type if available
  selectedModel: string;
}

const ExaminerActivity: React.FC<ExaminerActivityProps> = ({
  sessionId,
  startupStatus,
  progress,
  results,
  selectedModel,
}) => {
  return (
    <div className="space-y-4">
      {/* Pre-Completion Processing Activity */}
      {sessionId && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-orange-600 animate-spin" />
              Live Processing Activity
            </CardTitle>
            <p className="text-sm text-orange-700">
              Real-time updates of batch processing pipeline and API activity
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session Status */}
            <div className="p-3 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900">Batch Session</div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {sessionId.split('-')[0]}...
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                {startupStatus ? (
                  <div className="font-medium text-orange-700">{startupStatus}</div>
                ) : (
                  <div>✅ Session created successfully • 🚀 Processing initiated</div>
                )}
              </div>
            </div>

            {/* Processing Queue Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-blue-100 rounded-lg border border-blue-200">
                <div className="text-lg font-bold text-blue-700 animate-pulse">
                  {progress ? progress.progress.total - progress.progress.completed : '?'}
                </div>
                <div className="text-xs text-blue-600">🔄 In Progress</div>
              </div>
              <div className="text-center p-3 bg-gray-100 rounded-lg border border-gray-200">
                <div className="text-lg font-bold text-gray-700">
                  {progress ? progress.progress.total - progress.progress.completed : '?'}
                </div>
                <div className="text-xs text-gray-600">⏳ Queued</div>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
                <div className="text-lg font-bold text-green-700">
                  {progress?.progress.completed || 0}
                </div>
                <div className="text-xs text-green-600">✅ Completed</div>
              </div>
              <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
                <div className="text-lg font-bold text-red-700">
                  {progress?.progress.failed || 0}
                </div>
                <div className="text-xs text-red-600">❌ Failed</div>
              </div>
            </div>

            {/* API Processing Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">OpenAI API Processing</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600">Active</span>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-orange-200 p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Model:</span> <code className="text-blue-600">{selectedModel}</code>
                  </div>
                  <div>
                    <span className="text-gray-500">Expected Response:</span> <span className="text-orange-600">2-5 minutes</span>
                  </div>
                  {progress && progress.progress.percentage === 0 && (
                    <>
                      <div className="col-span-full">
                        <span className="text-amber-600">🔥 Active API calls processing...</span>
                      </div>
                      <div className="col-span-full text-xs text-gray-500">
                        💡 First responses typically arrive within 3 minutes for GPT-5 models with high reasoning effort
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Server Communication Status */}
            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-700">Server polling active</span>
              </div>
              <div className="text-xs text-gray-500">
                Updates every 2 seconds • Last check: just now
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Activity Log */}
      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Live Activity Log
            </CardTitle>
            <p className="text-sm text-gray-600">
              Real-time feed of puzzle processing and DB validation results
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results
                .sort((a: any, b: any) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
                .slice(0, 10) // Show only latest 10
                .map((result: any, index: number) => (
                <div key={result.id || index} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {result.puzzle_id}
                    </Badge>
                    {result.status === 'completed' ? (
                      <span className="text-green-600">✅ Reply received & validated</span>
                    ) : result.status === 'failed' ? (
                      <span className="text-red-600">❌ Failed: {result.error_message?.substring(0, 30)}...</span>
                    ) : (
                      <span className="text-blue-600">🔄 Waiting for reply...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {result.processing_time_ms && (
                      <span className="text-xs text-gray-500">
                        {Math.round(result.processing_time_ms / 1000)}s
                      </span>
                    )}
                    {result.accuracy_score !== undefined && (
                      <Badge variant={result.is_correct ? "default" : "secondary"} className="text-xs">
                        {Math.round(result.accuracy_score * 100)}%
                      </Badge>
                    )}
                    {result.status === 'completed' && (
                      <Link href={`/task/${result.puzzle_id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExaminerActivity;
