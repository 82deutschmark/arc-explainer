/**
 * collapsible-mission.tsx
 * 
 * A collapsible UI component that displays the mission statement for the ARC-AGI Puzzle Explorer.
 * This component replaces the large header text block with a compact, expandable section
 * to improve the landing page layout and user experience.
 * 
 * @author Cascade
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

export function CollapsibleMission() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="card w-full bg-base-100 shadow">
      <div className={`collapse ${isOpen ? 'collapse-open' : 'collapse-close'}`}>
        <div className="collapse-title">
          <button 
            className="w-full flex justify-between items-center p-0 h-auto"
            onClick={() => setIsOpen(!isOpen)}
          >
            <h2 className="card-title flex items-center gap-2 text-left">
              <Info className="h-5 w-5 text-blue-600" />
              Mission Statement & Project Background
            </h2>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
        
        <div className="collapse-content">
          <div className="pt-0 space-y-4 text-sm">
            <div className="space-y-3">
              <p className="text-gray-700 leading-relaxed">
                I started this project after stumbling onto the ARC-AGI "easy for humans" tagline and immediately feeling the opposite... 
                most of these puzzles made me feel <em>really</em> dumb. If you've ever stared at a grid and wondered what cosmic joke 
                you're missing, you're not alone.
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                I built this app to explain to me WHY these answers are correct. 
                These are the tasks directly cloned from the v1 and v2 sets of the ARC-AGI prize. The ARC-AGI puzzles are often described
                as "easy for humans," but let's be honest... they're not easy for most of us. 
                These tasks require sophisticated logical reasoning that many people find genuinely challenging.
              </p>
              
              <p className="text-gray-700 leading-relaxed">
                This app takes a different approach: instead of asking AI to solve these puzzles, 
                we ask it to explain why correct answers are correct. 
                The results are revealing, if AI models can't even articulate the reasoning behind known solutions, 
                how can they have any hope of solving novel problems?
              </p>
            </div>

            <div className="border-l-4 border-blue-200 pl-4 bg-blue-50 py-3 rounded-r">
              <h4 className="font-semibold text-gray-800 mb-2">Accessibility Focus</h4>
              <p className="text-gray-700 text-xs leading-relaxed mb-2">
                My dad is one of the smartest people I know, yet color-blindness turns half the grid into a monochrome blur for him.  
                My nephew dreams of running mission control for rocket ships in twenty years, but genetics means he inherited my dad's colorblindness!
                He'll need the fluid intelligence skills that can be built by solving these puzzles, and I don't want him to bounce off these puzzles just because the color palette got in the way.
              </p>
              
              <p className="text-gray-700 text-xs leading-relaxed">
                That's why this app replaces colors with emojis 
                (behind the scenes, it is still all numbers 0-9 and you can switch back to colors and numbers if you want).  
                The grids stay playful, the logic stays intact, and anyone—color-blind, math-shy, or simply curious 
                can explore the kind of reasoning that eludes AI.
              </p>
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800 mb-2">
                TL;DR: These puzzles are hard for a lot of humans (especially the neurodivergent), emojis are fun, 
                and accessibility matters.
              </p>
              
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                <p className="text-sm text-red-800 mb-2">
                  I also made this game based on ARC puzzles to help humans develop their fluid intelligence.
                </p>
                <a 
                  href="https://sfmc.markbarney.net" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-medium text-blue-700 hover:text-blue-900 underline"
                >
                  Check out my experiment here →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
