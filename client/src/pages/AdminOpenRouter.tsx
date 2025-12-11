/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-10
 * PURPOSE: Admin UI to discover OpenRouter models not yet in our DB/config and import selected slugs.
 * SRP/DRY check: Pass — discovery + import UI; no WormArena coupling.
 */

import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

type DiscoverResponse = {
  totalRemote: number;
  totalLocalConfig: number;
  totalLocalDb: number;
  newModels: Array<{
    id: string;
    name: string;
    contextLength: number | null;
    isPreview: boolean;
    inputCostPerM?: number | null;
    outputCostPerM?: number | null;
  }>;
};

export default function AdminOpenRouter() {
  const { toast } = useToast();
  const [discoverResult, setDiscoverResult] = React.useState<DiscoverResponse | null>(null);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [nameEdits, setNameEdits] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const formatUsdPerM = (value?: number | null): string | null => {
    if (value == null) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const renderPricing = (model: DiscoverResponse['newModels'][number]) => {
    const input = formatUsdPerM(model.inputCostPerM);
    const output = formatUsdPerM(model.outputCostPerM);
    if (!input && !output) return '';
    return (
      <div className="flex flex-col text-xs text-muted-foreground">
        {input && <span>In: {input}/M</span>}
        {output && <span>Out: {output}/M</span>}
      </div>
    );
  };

  const discover = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/openrouter/discover');
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Discovery failed');
      }
      const data = (await res.json()) as DiscoverResponse;
      setDiscoverResult(data);
      // reset selections
      const defaults: Record<string, boolean> = {};
      const names: Record<string, string> = {};
      (data.newModels || []).forEach((m) => {
        defaults[m.id] = true;
        names[m.id] = m.name || m.id;
      });
      setSelected(defaults);
      setNameEdits(names);
    } catch (err) {
      toast({
        title: 'Discovery failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const importMutation = useMutation({
    mutationFn: async (payload: { slugs: string[]; nameOverrides: Record<string, string> }) => {
      const res = await fetch('/api/admin/openrouter/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Import failed');
      }
      return res.json() as Promise<{ inserted: number; updated: number; totalRequested: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: 'Import complete',
        description: `Inserted ${data.inserted}, updated ${data.updated}.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const handleImport = () => {
    if (!discoverResult) return;
    const slugs = discoverResult.newModels.filter((m) => selected[m.id]).map((m) => m.id);
    if (slugs.length === 0) {
      toast({ title: 'No models selected', description: 'Select at least one model to import.' });
      return;
    }
    const nameOverrides: Record<string, string> = {};
    slugs.forEach((slug) => {
      if (nameEdits[slug]) {
        nameOverrides[slug] = nameEdits[slug];
      }
    });
    importMutation.mutate({ slugs, nameOverrides });
  };

  const toggleAll = (value: boolean) => {
    if (!discoverResult) return;
    const updated: Record<string, boolean> = {};
    discoverResult.newModels.forEach((m) => {
      updated[m.id] = value;
    });
    setSelected(updated);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">OpenRouter Models</h1>
        <p className="text-muted-foreground mt-1">
          Discover new OpenRouter slugs, select, and import into the project models table.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Discovery</CardTitle>
            <CardDescription>Fetch catalog and compare with DB + config roster.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={discover} disabled={loading}>
              {loading ? 'Discovering…' : 'Discover OpenRouter'}
            </Button>
            <Button variant="secondary" onClick={() => toggleAll(true)} disabled={!discoverResult}>
              Select all
            </Button>
            <Button variant="secondary" onClick={() => toggleAll(false)} disabled={!discoverResult}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {discoverResult ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary">Remote: {discoverResult.totalRemote}</Badge>
                <Badge variant="secondary">Local (config): {discoverResult.totalLocalConfig}</Badge>
                <Badge variant="secondary">Local (DB): {discoverResult.totalLocalDb}</Badge>
                <Badge>{discoverResult.newModels.length} new</Badge>
              </div>
              <Separator />
              {discoverResult.newModels.length === 0 ? (
                <div className="text-sm text-muted-foreground">No new OpenRouter models found.</div>
              ) : (
                <>
                  <div className="overflow-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">Select</TableHead>
                          <TableHead>Slug</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="w-40">Pricing</TableHead>
                          <TableHead className="w-32">Context</TableHead>
                          <TableHead className="w-32">Tags</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {discoverResult.newModels.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={!!selected[m.id]}
                                onCheckedChange={(v) =>
                                  setSelected((prev) => ({ ...prev, [m.id]: Boolean(v) }))
                                }
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{m.id}</TableCell>
                            <TableCell>
                              <Input
                                value={nameEdits[m.id] ?? m.name}
                                onChange={(e) =>
                                  setNameEdits((prev) => ({ ...prev, [m.id]: e.target.value }))
                                }
                              />
                            </TableCell>
                            <TableCell>{renderPricing(m)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {m.contextLength ? `${m.contextLength.toLocaleString()} tokens` : ''}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {m.isPreview && <Badge variant="outline">preview</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleImport} disabled={importMutation.isPending}>
                      {importMutation.isPending ? 'Importing…' : 'Import selected'}
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Run discovery to see new models.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
