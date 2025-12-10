/*
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-07
 * PURPOSE: User message injection UI for ARC3 Agent Playground.
 *          Allows user to send follow-up messages to continue agent exploration
 *          after it pauses or completes.
 * SRP/DRY check: Pass — isolates message injection controls from page orchestration.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Arc3AgentControlsProps {
  userMessage: string;
  setUserMessage: (value: string) => void;
  onSubmit: () => void;
}

export const Arc3AgentControls: React.FC<Arc3AgentControlsProps> = ({
  userMessage,
  setUserMessage,
  onSubmit,
}) => {
  return (
    <Card className="border-orange-500">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm text-orange-600">Send Message</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        <p className="text-[10px] text-muted-foreground">
          Chain your message to the agent for continued exploration:
        </p>
        <Textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          className="text-[11px] h-20 resize-none"
          placeholder="Send new guidance or observation..."
        />
        <Button onClick={onSubmit} size="sm" className="w-full h-7 text-[10px]">
          Send
        </Button>
      </CardContent>
    </Card>
  );
};

export default Arc3AgentControls;
