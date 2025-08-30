/**
 * PromptPreviewModal.tsx
 * NEEDS TO BE REWRITTEN!!!
 * Modal component for previewing the complete prompt that will be sent to AI models.
 * Works with the new modular prompt architecture (system + user prompts).
 * 
 * @author Claude Code with Sonnet 4
 * @date August 23, 2025
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Eye } from 'lucide-react';
import { ARCTask } from '@shared/types';

