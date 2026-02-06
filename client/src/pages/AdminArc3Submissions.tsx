/*
Author: GPT-5.2
Date: 2026-02-04
PURPOSE: Admin UI for ARC3 community game submissions. Lists pending/approved/rejected
         submissions from `/api/arc3-community/submissions` (token-gated), allows viewing
         submitted source, and supports publish/reject actions.
         Integration points: server/routes/arc3Community.ts admin submission endpoints.
SRP/DRY check: Pass - focused admin-only page; reuses shadcn/ui building blocks.
*/

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, FileCode, Shield, ThumbsDown, ThumbsUp } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'archived';

interface CommunityGameRow {
  id: number;
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
  creatorHandle: string | null;
  status: SubmissionStatus;
  isPlayable: boolean;
  uploadedAt: string;
}

interface SubmissionsResponse {
  success: boolean;
  data?: {
    games: CommunityGameRow[];
    total: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

interface SubmissionSourceResponse {
  success: boolean;
  data?: {
    submissionId: string;
    gameId: string;
    sourceCode: string;
    hash: string;
    status: SubmissionStatus;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

const ADMIN_TOKEN_STORAGE_KEY = 'arc3CommunityAdminToken';

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = (await res.text()) || res.statusText;
  throw new Error(`${res.status}: ${text}`);
}

function statusBadgeVariant(status: SubmissionStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'approved') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'pending') return 'secondary';
  return 'outline';
}

export default function AdminArc3Submissions() {
  const queryClient = useQueryClient();

  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '');
  const [status, setStatus] = useState<SubmissionStatus>('pending');

  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceDialogTitle, setSourceDialogTitle] = useState<string>('Submission Source');
  const [sourceDialogBody, setSourceDialogBody] = useState<string>('');

  const tokenConfigured = useMemo(() => adminToken.trim().length > 0, [adminToken]);

  const submissionsQuery = useQuery<SubmissionsResponse>({
    queryKey: ['arc3-community-admin-submissions', status, tokenConfigured],
    enabled: tokenConfigured,
    queryFn: async () => {
      const url = `/api/arc3-community/submissions?status=${encodeURIComponent(status)}&limit=100&orderBy=uploadedAt&orderDir=DESC`;
      const res = await fetch(url, {
        headers: { 'X-ARC3-Admin-Token': adminToken.trim() },
      });
      await throwIfNotOk(res);
      return (await res.json()) as SubmissionsResponse;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const res = await fetch(`/api/arc3-community/submissions/${submissionId}/publish`, {
        method: 'POST',
        headers: { 'X-ARC3-Admin-Token': adminToken.trim() },
      });
      await throwIfNotOk(res);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['arc3-community-admin-submissions'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const reason = window.prompt('Reject reason (optional):') || '';
      const res = await fetch(`/api/arc3-community/submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-ARC3-Admin-Token': adminToken.trim() },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      await throwIfNotOk(res);
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['arc3-community-admin-submissions'] });
    },
  });

  const sourceMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const res = await fetch(`/api/arc3-community/submissions/${submissionId}/source`, {
        headers: { 'X-ARC3-Admin-Token': adminToken.trim() },
      });
      await throwIfNotOk(res);
      return (await res.json()) as SubmissionSourceResponse;
    },
    onSuccess: (data) => {
      const gameId = data.data?.gameId || 'unknown';
      setSourceDialogTitle(`Submission Source: ${gameId}`);
      setSourceDialogBody(data.data?.sourceCode || '');
      setSourceDialogOpen(true);
    },
  });

  const games = submissionsQuery.data?.data?.games ?? [];
  const total = submissionsQuery.data?.data?.total ?? 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">ARC3 Submissions</h1>
          <p className="text-muted-foreground">
            Review and publish community game uploads (token-gated).
          </p>
        </div>
        <Link href="/admin">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Admin Token
          </CardTitle>
          <CardDescription>
            Set `ARC3_COMMUNITY_ADMIN_TOKEN` on the server, then paste the same token here for admin actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="arc3-admin-token">Token</Label>
              <Input
                id="arc3-admin-token"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="Paste admin token"
              />
            </div>
            <Button
              onClick={() => {
                localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken.trim());
                queryClient.invalidateQueries({ queryKey: ['arc3-community-admin-submissions'] });
              }}
              disabled={!adminToken.trim()}
            >
              Save Token
            </Button>
          </div>

          {!tokenConfigured && (
            <Alert>
              <AlertDescription>
                Enter and save an admin token to view submissions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Submissions</CardTitle>
            <CardDescription>
              Status filter and actions (publish makes a game playable).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as SubmissionStatus)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => submissionsQuery.refetch()}
              disabled={!tokenConfigured || submissionsQuery.isFetching}
            >
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {submissionsQuery.isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {submissionsQuery.error instanceof Error ? submissionsQuery.error.message : 'Failed to load submissions'}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground mb-3">
            Showing {games.length} of {total}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {tokenConfigured ? 'No submissions found for this filter.' : 'Set an admin token to load submissions.'}
                  </TableCell>
                </TableRow>
              ) : (
                games.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-xs">{g.id}</TableCell>
                    <TableCell className="min-w-[220px]">
                      <div className="font-medium">{g.displayName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{g.gameId}</div>
                    </TableCell>
                    <TableCell>{g.authorName}</TableCell>
                    <TableCell className="text-xs">
                      {g.creatorHandle ? (
                        <span className="font-mono">{g.creatorHandle}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(g.status)}>{g.status}</Badge>
                      {g.status === 'approved' && g.isPlayable && (
                        <Badge variant="outline" className="ml-2">playable</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sourceMutation.mutate(g.id)}
                          disabled={!tokenConfigured || sourceMutation.isPending}
                          title="View submitted source"
                        >
                          <FileCode className="h-4 w-4" />
                          Source
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => publishMutation.mutate(g.id)}
                          disabled={!tokenConfigured || publishMutation.isPending || g.status === 'approved'}
                          title="Publish (approve + make playable)"
                        >
                          <ThumbsUp className="h-4 w-4" />
                          Publish
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => rejectMutation.mutate(g.id)}
                          disabled={!tokenConfigured || rejectMutation.isPending || g.status === 'rejected'}
                          title="Reject (keeps non-playable)"
                        >
                          <ThumbsDown className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{sourceDialogTitle}</DialogTitle>
            <DialogDescription>
              Read-only view of the stored submission source.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={sourceDialogBody}
            readOnly
            className="font-mono text-xs min-h-[60vh]"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

