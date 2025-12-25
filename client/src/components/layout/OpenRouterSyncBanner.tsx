/**
 * OpenRouterSyncBanner.tsx
 *
 * Author: Claude Haiku 4.5
 * Date: 2025-12-24
 * PURPOSE: Dismissible banner showing OpenRouter catalog sync status
 *          Displays last sync time and count of new models discovered
 * SRP/DRY check: Pass - isolated banner component, no dependencies on other banners
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOpenRouterSyncStatus } from '@/hooks/useOpenRouterSyncStatus';
import { formatDistanceToNow } from 'date-fns';

export function OpenRouterSyncBanner() {
  const { data, isLoading } = useOpenRouterSyncStatus();
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Load dismissed state from localStorage keyed by last sync time
  useEffect(() => {
    if (data?.lastSyncAt) {
      const dismissedKey = `openrouter-sync-banner-dismissed-${data.lastSyncAt}`;
      const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
      setIsDismissed(wasDismissed);
    }
  }, [data?.lastSyncAt]);

  const handleDismiss = () => {
    if (data?.lastSyncAt) {
      const dismissedKey = `openrouter-sync-banner-dismissed-${data.lastSyncAt}`;
      localStorage.setItem(dismissedKey, 'true');
      setIsDismissed(true);
    }
  };

  // Hide if loading, no data, already dismissed, or no new models
  if (isLoading || !data || isDismissed || data.newModelsCount === 0) {
    return null;
  }

  const lastSyncTime = formatDistanceToNow(new Date(data.lastSyncAt), { addSuffix: true });
  const variant = data.isStale ? 'destructive' : 'default';

  return (
    <div className="w-full border-b bg-background px-4 py-3 sticky top-0 z-40">
      <Alert variant={variant}>
        <RefreshCw className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>OpenRouter Catalog Updated</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 hover:bg-transparent"
          >
            ×
          </Button>
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span>Last synced {lastSyncTime}</span>
            {data.catalogAge > 24 && (
              <Badge variant="secondary" className="text-xs">
                {Math.floor(data.catalogAge)} hours old
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-xs">
              {data.newModelsCount} new {data.newModelsCount === 1 ? 'model' : 'models'}
            </Badge>
            {data.newModelsCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 gap-1 px-1 text-xs"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                View
              </Button>
            )}
          </div>

          {isExpanded && data.newModels.length > 0 && (
            <div className="mt-3 space-y-1 border-t pt-2">
              {data.newModels.map(model => (
                <div key={model.id} className="text-xs text-muted-foreground">
                  <span className="font-mono">{model.id}</span>
                  {model.name !== model.id && <span className="ml-2">({model.name})</span>}
                </div>
              ))}
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
