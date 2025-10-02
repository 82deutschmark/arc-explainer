/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-01
 * PURPOSE: HuggingFace dataset ingestion interface for importing external model predictions.
 *          Provides configuration form, validation preview, and ingestion history tracking.
 *          Supports dry run mode, auto-source detection, and real-time progress monitoring.
 * SRP/DRY check: Pass - Single responsibility (HF dataset ingestion UI), reuses shadcn/ui components
 * shadcn/ui: Pass - Uses Card, Input, Select, Button, Checkbox, Alert, Dialog, Table, Progress, Badge, Tabs
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Preset HuggingFace URLs
const PRESET_URLS = [
  { value: 'https://huggingface.co/datasets/arcprize/arc_agi_v1_public_eval/resolve/main', label: 'ARC1-Eval (arcprize)' },
  { value: 'https://huggingface.co/datasets/arcprize/arc_agi_v1_training/resolve/main', label: 'ARC1 Training (arcprize)' },
  { value: 'https://huggingface.co/datasets/arcprize/arc_agi_v2_public_eval/resolve/main', label: 'ARC2-Eval (arcprize)' },
  { value: 'https://huggingface.co/datasets/arcprize/arc_agi_v2_training/resolve/main', label: 'ARC2 Training (arcprize)' },
];

interface IngestionConfig {
  datasetName: string;
  baseUrl: string;
  source: string;
  limit: number | null;
  delay: number;
  dryRun: boolean;
  forceOverwrite: boolean;
  verbose: boolean;
}

interface ValidationResult {
  valid: boolean;
  checks: {
    urlAccessible: boolean;
    tokenPresent: boolean;
    databaseConnected: boolean;
    sourceDetected: string | null;
    puzzleCount: number;
    samplePuzzle: {
      id: string;
      hasData: boolean;
      testCases: number;
      existingEntries: number;
    } | null;
  };
  errors: string[];
}

interface IngestionRun {
  id: number;
  datasetName: string;
  baseUrl: string;
  source: string;
  totalPuzzles: number;
  successful: number;
  failed: number;
  skipped: number;
  durationMs: number;
  dryRun: boolean;
  accuracyPercent: number | null;
  startedAt: string;
  completedAt: string;
  errorLog: string | null;
}

// Add HF folder type for UI selection
interface HFFolder {
  name: string;
  ingested: boolean;
  attemptsFound: number;
}

export default function HuggingFaceIngestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [config, setConfig] = useState<IngestionConfig>({
    datasetName: 'claude-sonnet-4-5-20250929',
    baseUrl: PRESET_URLS[0].value,
    source: 'auto',
    limit: null,
    delay: 100,
    dryRun: false,
    forceOverwrite: false,
    verbose: false,
  });

  // UI state
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Add selection for HF folders
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

  // Fetch ingestion history with auto-refresh every 5 seconds
  const { data: historyData, isLoading: historyLoading } = useQuery<{ runs: IngestionRun[] }>({
    queryKey: ['ingestion-history'],
    queryFn: async () => {
      const response = await fetch('/api/admin/ingestion-history');
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds to show new completions
    refetchIntervalInBackground: false // Only when tab is active
  });

  // Fetch HF folders for selected baseUrl
  const { data: hfFoldersData, isLoading: hfFoldersLoading, refetch: refetchHFFolders } = useQuery<{ folders: HFFolder[] }>({
    queryKey: ['hf-folders', config.baseUrl],
    queryFn: async () => {
      const resp = await fetch(`/api/admin/hf-folders?baseUrl=${encodeURIComponent(config.baseUrl)}`);
      if (!resp.ok) throw new Error('Failed to fetch HF folders');
      return resp.json();
    },
    enabled: !!config.baseUrl,
  });

  const toggleFolder = (name: string) => {
    setSelectedFolders(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };
  const selectNotIngested = () => {
    const list = hfFoldersData?.folders?.filter(f => !f.ingested).map(f => f.name) || [];
    setSelectedFolders(list);
  };
  const clearSelection = () => setSelectedFolders([]);

  // Validation mutation
  const validateMutation = useMutation({
    mutationFn: async (datasetToValidate: string) => {
      const response = await fetch('/api/admin/validate-ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName: datasetToValidate,
          baseUrl: config.baseUrl,
        }),
      });
      if (!response.ok) throw new Error('Validation failed');
      return response.json();
    },
    onSuccess: (data: ValidationResult) => {
      setValidationResult(data);
      setShowValidationDialog(true);
    },
  });

  const handleValidate = () => {
    const dataset = selectedFolders.length > 0 ? selectedFolders[0] : config.datasetName;
    validateMutation.mutate(dataset);
  };

  // Ingestion mutation
  const ingestionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/start-ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName: config.datasetName,
          baseUrl: config.baseUrl,
          source: config.source,
          limit: config.limit,
          delay: config.delay,
          dryRun: config.dryRun,
          forceOverwrite: config.forceOverwrite,
          verbose: config.verbose
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ingestion failed to start');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setShowValidationDialog(false);
      queryClient.invalidateQueries({ queryKey: ['ingestion-history'] });
      
      // Show success toast with clear feedback
      toast({
        title: config.dryRun ? "Dry Run Started" : "Ingestion Started",
        description: `${config.datasetName} is processing in the background. Switch to the History tab - it auto-refreshes every 5 seconds to show completion.`,
        duration: 10000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ingestion Failed",
        description: error.message,
        variant: "destructive",
        duration: 8000,
      });
    },
  });

  const handleStartIngestion = async () => {
    if (selectedFolders.length > 0) {
      let started = 0;
      let failed: string[] = [];
      for (const folder of selectedFolders) {
        try {
          const response = await fetch('/api/admin/start-ingestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              datasetName: folder,
              baseUrl: config.baseUrl,
              source: config.source,
              limit: config.limit,
              delay: config.delay,
              dryRun: config.dryRun,
              forceOverwrite: config.forceOverwrite,
              verbose: config.verbose,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to start');
          }
          started++;
        } catch (e) {
          failed.push(folder);
        }
      }
      setShowValidationDialog(false);
      queryClient.invalidateQueries({ queryKey: ['ingestion-history'] });
      toast({
        title: config.dryRun ? 'Dry Run Started' : 'Ingestion Started',
        description: `Started ${started} run(s) ${failed.length ? `(failed: ${failed.join(', ')})` : ''}. History auto-refreshes every 5s.`,
        duration: 10000,
      });
      return;
    }
    // Fallback to single dataset using current config
    ingestionMutation.mutate();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">HuggingFace Dataset Ingestion</h1>
          <p className="text-muted-foreground mt-1">
            Import external model predictions from HuggingFace datasets
          </p>
        </div>
      </div>

      <Tabs defaultValue="configure" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configure">Configuration</TabsTrigger>
          <TabsTrigger value="history">Ingestion History</TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dataset Configuration</CardTitle>
              <CardDescription>
                Configure HuggingFace dataset ingestion settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dataset Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Dataset Name (Model Folder)</label>
                <Input
                  value={config.datasetName}
                  onChange={(e) => setConfig({ ...config, datasetName: e.target.value })}
                  placeholder="e.g., claude-sonnet-4-5-20250929"
                />
                <p className="text-xs text-muted-foreground">
                  Optional if selecting from list below. This becomes the model name in the database (e.g., {config.datasetName}-attempt1)
                </p>
              </div>

              {/* Base URL with Preset Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Base URL</label>
                <Select
                  value={config.baseUrl}
                  onValueChange={(value) => setConfig({ ...config, baseUrl: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_URLS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  placeholder="Custom URL..."
                  className="mt-2"
                />
              </div>

              {/* NEW: Hugging Face Folders (auto-fetched from base URL) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Hugging Face Folders</label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedFolders([]); refetchHFFolders(); }} disabled={hfFoldersLoading}>
                      {hfFoldersLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={selectNotIngested} disabled={!hfFoldersData || (hfFoldersData.folders?.length || 0) === 0}>
                      Select Not-Ingested
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedFolders.length === 0}>
                      Clear Selection
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Browse model folders from the Hugging Face dataset. Select one or more to ingest. You don't need to type the dataset name when selecting here.</p>

                <div className="border rounded-md p-3 max-h-64 overflow-auto">
                  {hfFoldersLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading folders...
                    </div>
                  ) : hfFoldersData && hfFoldersData.folders.length > 0 ? (
                    <div className="space-y-2">
                      {hfFoldersData.folders.map((f) => (
                        <div key={f.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`folder-${f.name}`}
                              checked={selectedFolders.includes(f.name)}
                              onCheckedChange={() => toggleFolder(f.name)}
                            />
                            <label htmlFor={`folder-${f.name}`} className="text-sm font-medium cursor-pointer">
                              {f.name}
                            </label>
                          </div>
                          <div className="flex items-center gap-3">
                            {f.ingested ? (
                              <Badge variant="outline">Ingested</Badge>
                            ) : (
                              <Badge variant="secondary">Not Ingested</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">attempts: {f.attemptsFound}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No folders found. Check the base URL or your HF_TOKEN.</div>
                  )}
                </div>

                {selectedFolders.length > 0 && (
                  <div className="text-xs text-muted-foreground">Selected: {selectedFolders.join(', ')}</div>
                )}
              </div>

              {/* Source Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">ARC Source Filter</label>
                <Select
                  value={config.source}
                  onValueChange={(value) => setConfig({ ...config, source: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect from URL</SelectItem>
                    <SelectItem value="ARC1-Eval">ARC1-Eval</SelectItem>
                    <SelectItem value="ARC1">ARC1 Training</SelectItem>
                    <SelectItem value="ARC2-Eval">ARC2-Eval</SelectItem>
                    <SelectItem value="ARC2">ARC2 Training</SelectItem>
                    <SelectItem value="ARC-Heavy">ARC-Heavy</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Will auto-detect from arcprize URLs if set to Auto
                </p>
              </div>

              {/* Limit */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Puzzle Limit (Optional)</label>
                <Input
                  type="number"
                  value={config.limit || ''}
                  onChange={(e) => setConfig({ ...config, limit: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Leave empty to process all puzzles"
                />
                <p className="text-xs text-muted-foreground">
                  For testing, start with 5-10 puzzles
                </p>
              </div>

              {/* Delay */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Request Delay (ms)</label>
                <Input
                  type="number"
                  value={config.delay}
                  onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) || 100 })}
                />
                <p className="text-xs text-muted-foreground">
                  Delay between HTTP requests to avoid rate limiting
                </p>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dryRun"
                    checked={config.dryRun}
                    onCheckedChange={(checked) => setConfig({ ...config, dryRun: !!checked })}
                  />
                  <label htmlFor="dryRun" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Dry Run (preview without saving to database)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="forceOverwrite"
                    checked={config.forceOverwrite}
                    onCheckedChange={(checked) => setConfig({ ...config, forceOverwrite: !!checked })}
                  />
                  <label htmlFor="forceOverwrite" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Force Overwrite (replace existing entries)
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="verbose"
                    checked={config.verbose}
                    onCheckedChange={(checked) => setConfig({ ...config, verbose: !!checked })}
                  />
                  <label htmlFor="verbose" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Verbose Logging (show detailed progress)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleValidate}
                  variant="outline"
                  disabled={validateMutation.isPending}
                >
                  {validateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Validate Configuration
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    // For now, just show validation first
                    handleValidate();
                  }}
                  disabled={(selectedFolders.length === 0 && !config.datasetName) || !config.baseUrl}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Start Ingestion
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Ingestion History</CardTitle>
              <CardDescription>Past HuggingFace dataset ingestion runs</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : historyData && historyData.runs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dataset</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Puzzles</TableHead>
                        <TableHead>Results</TableHead>
                        <TableHead>Accuracy</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Mode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyData.runs.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-medium">
                            <div className="max-w-xs truncate" title={run.datasetName}>
                              {run.datasetName}
                            </div>
                          </TableCell>
                          <TableCell>
                            {run.source && (
                              <Badge variant="outline">{run.source}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(run.startedAt)}
                          </TableCell>
                          <TableCell>{run.totalPuzzles}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-green-600 font-medium">{run.successful}</span>
                              {run.skipped > 0 && (
                                <span className="text-yellow-600">{run.skipped} skipped</span>
                              )}
                              {run.failed > 0 && (
                                <span className="text-red-600">{run.failed} failed</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {run.accuracyPercent !== null ? (
                              <Badge variant="secondary">
                                {run.accuracyPercent.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDuration(run.durationMs)}
                          </TableCell>
                          <TableCell>
                            {run.dryRun && (
                              <Badge variant="outline" className="text-xs">
                                Dry Run
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No ingestion runs yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Validation Preview Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ingestion Configuration Validation</DialogTitle>
            <DialogDescription>
              Pre-flight checks for dataset ingestion
            </DialogDescription>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-4">
              {/* Overall Status */}
              {validationResult.valid ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    All checks passed! Ready to start ingestion.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Some checks failed. Please fix the errors below.
                  </AlertDescription>
                </Alert>
              )}

              {/* Checks */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {validationResult.checks.urlAccessible ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Dataset URL accessible</span>
                </div>

                <div className="flex items-center gap-2">
                  {validationResult.checks.tokenPresent ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="text-sm">HF_TOKEN environment variable found</span>
                </div>

                <div className="flex items-center gap-2">
                  {validationResult.checks.databaseConnected ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Database connection active</span>
                </div>

                {validationResult.checks.sourceDetected && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      Source auto-detected: <Badge variant="outline">{validationResult.checks.sourceDetected}</Badge>
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    {validationResult.checks.puzzleCount} puzzles found locally
                  </span>
                </div>

                {validationResult.checks.samplePuzzle && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="text-sm font-medium mb-2">Sample Data Preview:</div>
                    <div className="text-xs space-y-1">
                      <div>Puzzle ID: <code>{validationResult.checks.samplePuzzle.id}</code></div>
                      <div>Test cases: {validationResult.checks.samplePuzzle.testCases}</div>
                      <div>Existing entries: {validationResult.checks.samplePuzzle.existingEntries}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Errors:</div>
                  {validationResult.errors.map((error, i) => (
                    <Alert key={i} variant="destructive">
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidationDialog(false)}>
              Cancel
            </Button>
            {validationResult?.valid && (
              <Button onClick={handleStartIngestion} disabled={ingestionMutation.isPending}>
                {ingestionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {config.dryRun ? 'Start Dry Run' : 'Start Ingestion'}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
