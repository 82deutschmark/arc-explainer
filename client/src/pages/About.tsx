/**
 * About.tsx
 * 
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: About page for ARC-AGI Puzzle Explorer with acknowledgments, project information, and links
 * SRP/DRY check: Pass - Single responsibility of displaying project information and credits
 * DaisyUI: Pass - Converted to pure DaisyUI components
 */

import React from 'react';
import { 
  Github, 
  Heart, 
  ExternalLink, 
  Users, 
  BookOpen, 
  Code,
  Sparkles,
  Mail
} from 'lucide-react';

export default function About() {
  // Set page title
  React.useEffect(() => {
    document.title = 'About - ARC Puzzle Explorer';
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-200 to-primary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Hero Header */}
        <header className="text-center space-y-4 py-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            About This Project
          </h1>
          <p className="text-lg text-base-content/70">
            Built with curiosity, accessibility, and LLMs
          </p>
        </header>

        {/* Project Overview */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <Sparkles className="h-6 w-6 text-primary" />
              What Is This?
            </h2>
            <div className="space-y-4">
              <p className="text-base-content/80 leading-relaxed">
                The <strong>ARC-AGI Puzzle Explorer</strong> is a hobby project born from frustration and curiosity. 
                When I first encountered ARC-AGI puzzles labeled as "easy for humans," I felt anything but smart. 
                Most of these puzzles made me feel genuinely confused, and I wanted to understand <em>why</em> the answers were correct.
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="badge badge-outline badge-primary">Open Source</div>
                <div className="badge badge-outline badge-success">Accessibility First</div>
                <div className="badge badge-outline badge-secondary">AI Research</div>
                <div className="badge badge-outline badge-accent">Hobby Project</div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Story */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <Heart className="h-6 w-6 text-error" />
              The Personal Story
            </h2>
            <div className="space-y-4">
              <p className="text-base-content/80 leading-relaxed">
                I started this project after stumbling onto the ARC-AGI "easy for humans" tagline and immediately feeling the opposite... 
                most of these puzzles made me feel <em>really</em> dumb. If you've ever stared at a grid and wondered what cosmic joke 
                you're missing, you're not alone.
              </p>
              
              <p className="text-base-content/80 leading-relaxed">
                I built this app to explain to me WHY these answers are correct. 
                These are the tasks directly cloned from the v1 and v2 sets of the ARC-AGI prize. The ARC-AGI puzzles are often described
                as "easy for humans," but let's be honest... they're not easy for most of us. 
                These tasks require sophisticated logical reasoning that many people find genuinely challenging.
              </p>
              
              <p className="text-base-content/80 leading-relaxed">
                This app takes a different approach: instead of asking AI to solve these puzzles, 
                we ask it to explain why correct answers are correct. 
                The results are revealing. If AI models can't even articulate the reasoning behind known solutions, 
                how can they have any hope of solving novel problems?
              </p>
            </div>
          </div>
        </div>

        {/* Accessibility Focus */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <BookOpen className="h-6 w-6 text-success" />
              Why Accessibility Matters
            </h2>
            <div className="space-y-4">
              <p className="text-base-content/80 leading-relaxed">
                My dad is one of the smartest people I know, yet color-blindness turns half the grid into a monochrome blur for him.  
                My nephew dreams of running mission control for rocket ships in twenty years, but genetics means he inherited my dad's colorblindness!
                He'll need the fluid intelligence skills that can be built by solving these puzzles, and I don't want him to bounce off these puzzles just because the color palette got in the way.
              </p>
              
              <p className="text-base-content/80 leading-relaxed">
                That's why this app replaces colors with emojis 
                (behind the scenes, it is still all numbers 0-9 and you can switch back to colors and numbers if you want).  
                The grids stay playful, the logic stays intact, and anyone—color-blind, math-shy, or simply curious—
                can explore the kind of reasoning that eludes AI.
              </p>
              
              <div className="mt-4 p-4 bg-green-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-800 mb-2">
                  I also made a game based on ARC puzzles to help humans develop their fluid intelligence.
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

        {/* Technology Stack */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <Code className="h-6 w-6 text-success" />
              Technology & Open Source
            </h2>
            <div className="space-y-4">
              <p className="text-base-content/80 leading-relaxed">
                This project is built with modern web technologies including React, TypeScript, TailwindCSS, 
                DaisyUI components, PostgreSQL, and Express. It integrates with multiple AI providers 
                (OpenAI, Anthropic, Google Gemini, DeepSeek, and more) to test their reasoning capabilities.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a 
                  href="https://github.com/82deutschmark/arc-explainer" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary gap-2"
                >
                  <Github className="h-5 w-5" />
                  View on GitHub
                  <ExternalLink className="h-4 w-4" />
                </a>
                <a 
                  href="https://www.arxiv.org/pdf/2505.11831" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-outline gap-2"
                >
                  <BookOpen className="h-5 w-5" />
                  ARC2 Research Paper
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Acknowledgments */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <Users className="h-6 w-6 text-secondary" />
              Acknowledgments & Credits
            </h2>
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-base-content mb-1">François Chollet & The ARC Prize Team</h4>
                  <p className="text-sm text-base-content/70">
                    For creating the ARC-AGI challenge and pushing the boundaries of what we understand about 
                    machine intelligence and reasoning.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-base-content mb-1">The Open Source Community</h4>
                  <p className="text-sm text-base-content/70">
                    This project stands on the shoulders of countless open-source contributors who built the 
                    amazing tools and libraries that make modern web development possible.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-base-content mb-1">Discord ARC-AGI Community</h4>
                  <p className="text-sm text-base-content/70">
                    For the ongoing work in understanding and improving AI reasoning capabilities, and for making 
                    these powerful models accessible through APIs.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-base-content mb-1">You!</h4>
                  <p className="text-sm text-base-content/70">
                    For exploring these puzzles, contributing feedback, and caring about accessibility and 
                    understanding in AI research.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact & Links */}
        <div className="card bg-gradient-to-r from-primary/10 to-secondary/10 shadow-xl">
          <div className="card-body">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold">Get Involved</h3>
              <p className="text-base-content/80">
                This is a hobby project with a small but dedicated community. Contributions, feedback, 
                and bug reports are always welcome!
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <a 
                  href="https://github.com/82deutschmark/arc-explainer/issues" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm gap-2"
                >
                  <Github className="h-4 w-4" />
                  Report an Issue
                </a>
                <a 
                  href="https://github.com/82deutschmark" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm gap-2"
                >
                  <Github className="h-4 w-4" />
                  Follow on GitHub
                </a>
              </div>
              <p className="text-sm text-base-content/60 pt-4">
                Made with <Heart className="h-4 w-4 inline text-error" /> by a hobbyist who just wanted 
                to understand some puzzles.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
