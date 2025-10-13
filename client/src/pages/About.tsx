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

        {/* Why This Matters */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <Heart className="h-6 w-6 text-error" />
              Why Accessibility Matters
            </h2>
            <div className="space-y-4">
              <p className="text-base-content/80 leading-relaxed">
                I want people from outside of computer science, machine learning, and math to understand the capabilities of AI models.
              </p>
              <p className="text-base-content/80 leading-relaxed">
                I want to explore the kind of reasoning that currently eludes AI.
              </p>
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
