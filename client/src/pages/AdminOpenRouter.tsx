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

type CatalogModel = {
  id: string;
  name?: string;
  description?: string;
  created?: number;
  context_length?: number | null;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  } | null;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
    web_search?: string;
    internal_reasoning?: string;
    input_cache_read?: string;
    input_cache_write?: string;
  } | null;
  top_provider?: {
    context_length?: number | null;
    max_completion_tokens?: number | null;
    is_moderated?: boolean;
  } | null;
  supported_parameters?: string[] | null;
  default_parameters?: Record<string, unknown> | null;
  inputCostPerM?: number | null;
  outputCostPerM?: number | null;
  isPreview?: boolean;
};

type CatalogResponse = {
  total: number;
  models: CatalogModel[];
};

type SyncConfigResponse = {
  success: boolean;
  totalRemote: number;
  totalInConfig: number;
  filteredOut: number;
  newModels: Array<{
    id: string;
    name?: string;
    contextLength?: number;
    pricing?: {
      input?: string;
      completion?: string;
    };
  }>;
  snippet: string;
  message: string;
};

export default function AdminOpenRouter() {
  const { toast } = useToast();
  const [discoverResult, setDiscoverResult] = React.useState<DiscoverResponse | null>(null);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [nameEdits, setNameEdits] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [catalog, setCatalog] = React.useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogSearch, setCatalogSearch] = React.useState('');
  const [syncResult, setSyncResult] = React.useState<SyncConfigResponse | null>(null);
  const [syncLoading, setSyncLoading] = React.useState(false);
  const [maxInputCost, setMaxInputCost] = React.useState('');
  const [maxOutputCost, setMaxOutputCost] = React.useState('5.0');

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
    if (!input && !output) return 'N/A';
    return (
      <div className="flex flex-col text-xs text-muted-foreground">
        {input && <span>In: {input}/M</span>}
        {output && <span>Out: {output}/M</span>}
      </div>
    );
  };

  const renderCatalogPricing = (model: CatalogModel) => {
    const input = formatUsdPerM(model.inputCostPerM ?? null);
    const output = formatUsdPerM(model.outputCostPerM ?? null);
    if (!input && !output) return 'N/A';
    return (
      <div className="flex flex-col text-xs text-muted-foreground">
        {input && <span>In: {input}/M</span>}
        {output && <span>Out: {output}/M</span>}
      </div>
    );
  };

  const renderCatalogModality = (model: CatalogModel) => {
    const arch = model.architecture;
    if (!arch) return 'N/A';
    const parts: string[] = [];
    if (arch.modality) parts.push(arch.modality);
    if (arch.input_modalities && arch.input_modalities.length > 0) {
      parts.push('In: ' + arch.input_modalities.join(','));
    }
    if (arch.output_modalities && arch.output_modalities.length > 0) {
      parts.push('Out: ' + arch.output_modalities.join(','));
    }
    return parts.length > 0 ? parts.join(' | ') : 'N/A';
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

  const loadCatalog = React.useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await fetch('/api/admin/openrouter/catalog');
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Catalog fetch failed');
      }
      const data = (await res.json()) as CatalogResponse;
      setCatalog(data);
    } catch (err) {
      toast({
        title: 'Catalog fetch failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCatalogLoading(false);
    }
  }, [toast]);

  const syncConfig = React.useCallback(async () => {
    setSyncLoading(true);
    try {
      const params = new URLSearchParams();
      if (maxInputCost) params.append('maxInputCost', maxInputCost);
      if (maxOutputCost) params.append('maxOutputCost', maxOutputCost);

      const url = `/api/admin/openrouter/sync-config${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Sync failed');
      }
      const data = (await res.json()) as SyncConfigResponse;
      setSyncResult(data);
      toast({
        title: 'Config sync complete',
        description: data.message,
      });
    } catch (err) {
      toast({
        title: 'Config sync failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSyncLoading(false);
    }
  }, [toast, maxInputCost, maxOutputCost]);

  const handleDownloadCatalog = () => {
    if (!catalog) return;
    try {
      const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'openrouter-catalog.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const catalogModels: CatalogModel[] = React.useMemo(() => {
    if (!catalog) return [];
    const query = catalogSearch.trim().toLowerCase();
    if (!query) return catalog.models;
    return catalog.models.filter((m) => {
      const slug = m.id.toLowerCase();
      const name = (m.name || '').toLowerCase();
      return slug.includes(query) || name.includes(query);
    });
  }, [catalog, catalogSearch]);

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
              {loading ? 'Discovering...' : 'Discover OpenRouter'}
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
                              {m.contextLength ? `${m.contextLength.toLocaleString()} tokens` : 'N/A'}
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
                      {importMutation.isPending ? 'Importing...' : 'Import selected'}
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

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Full OpenRouter Catalog</CardTitle>
            <CardDescription>Browse all OpenRouter models, pricing, and capabilities.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Filter by slug or name"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="w-56"
            />
            <Button onClick={loadCatalog} disabled={catalogLoading}>
              {catalogLoading ? 'Loading catalog...' : 'Load catalog'}
            </Button>
            <Button variant="secondary" onClick={handleDownloadCatalog} disabled={!catalog}>
              Download JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {catalog ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary">Total models: {catalog.total}</Badge>
                <Badge variant="secondary">Visible: {catalogModels.length}</Badge>
              </div>
              <Separator />
              {catalogModels.length === 0 ? (
                <div className="text-sm text-muted-foreground">No models match the current filter.</div>
              ) : (
                <div className="overflow-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Slug</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-40">Pricing</TableHead>
                        <TableHead className="w-32">Context</TableHead>
                        <TableHead className="w-48">Modality</TableHead>
                        <TableHead className="w-40">Tags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {catalogModels.map((m) => {
                        const hasReasoning = (m.supported_parameters || []).some((p) =>
                          p === 'reasoning' || p === 'include_reasoning'
                        );
                        const inputs = (m.architecture?.input_modalities || []).map((v) => v.toLowerCase());
                        const hasVision = inputs.includes('image') || inputs.includes('video');
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs">{m.id}</TableCell>
                            <TableCell className="text-sm">{m.name || m.id}</TableCell>
                            <TableCell>{renderCatalogPricing(m)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {m.context_length != null
                                ? m.context_length.toLocaleString() + ' tokens'
                                : 'N/A'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {renderCatalogModality(m)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground space-x-2">
                              {m.isPreview && <Badge variant="outline">preview</Badge>}
                              {hasReasoning && <Badge variant="outline">reasoning</Badge>}
                              {hasVision && <Badge variant="outline">vision</Badge>}
                              {m.top_provider?.is_moderated && (
                                <Badge variant="outline">moderated</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Load the catalog to see the full list of OpenRouter models, pricing, and capabilities.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Sync Models to Config</CardTitle>
            <CardDescription>Generate TypeScript snippets to add new OpenRouter models to models.ts</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-md text-sm text-blue-800">
            <p className="font-semibold mb-2">Cost Filters (Optional)</p>
            <p className="text-xs mb-3">Exclude expensive models by setting maximum costs per million tokens:</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Max Input Cost ($/M)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 2.0"
                  value={maxInputCost}
                  onChange={(e) => setMaxInputCost(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Max Output Cost ($/M)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 5.0"
                  value={maxOutputCost}
                  onChange={(e) => setMaxOutputCost(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>
          <Button onClick={syncConfig} disabled={syncLoading} className="w-full">
            {syncLoading ? 'Syncing...' : 'Generate Snippets'}
          </Button>

          {syncResult && (
            <>
              <Separator className="my-4" />
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary">Remote: {syncResult.totalRemote}</Badge>
                <Badge variant="secondary">In config: {syncResult.totalInConfig}</Badge>
                {syncResult.filteredOut > 0 && <Badge variant="destructive">Filtered: {syncResult.filteredOut}</Badge>}
                <Badge>{syncResult.newModels.length} new</Badge>
              </div>
              {syncResult.newModels.length === 0 ? (
                <div className="text-sm text-muted-foreground">{syncResult.message}</div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground mb-4">{syncResult.message}</div>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-md font-mono text-xs overflow-auto max-h-96 border">
                    <pre>{syncResult.snippet}</pre>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    ✏️ Copy the snippet above and paste it into <code>server/config/models.ts</code> in the appropriate section.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(syncResult.snippet);
                      toast({ title: 'Copied!', description: 'Snippet copied to clipboard' });
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                </>
              )}
            </>
          )}

          {!syncResult && (
            <div className="text-sm text-muted-foreground">
              Click "Generate Snippets" to discover new OpenRouter models and generate TypeScript configuration for them.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
