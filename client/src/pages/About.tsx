/**
 * About.tsx
 * 
 * Author: Cascade using GPT-4
 * Date: 2025-10-01
 * PURPOSE: About page for ARC-AGI Puzzle Explorer with acknowledgments, project information, and links
 * SRP/DRY check: Pass - Single responsibility of displaying project information and credits
 * shadcn/ui: Pass - Uses Card, Button, Badge components from shadcn/ui
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 to-blue-800 bg-clip-text text-transparent">
            About This Project
          </h1>
          <p className="text-lg text-slate-600">
            Built with curiosity, accessibility, and a love for puzzles
          </p>
        </header>

        {/* Project Overview */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Sparkles className="h-6 w-6 text-blue-600" />
              What Is This?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              The <strong>ARC-AGI Puzzle Explorer</strong> is a hobby project born from frustration and curiosity. 
              When I first encountered ARC-AGI puzzles labeled as "easy for humans," I felt anything but smart. 
              Most of these puzzles made me feel genuinely confused, and I wanted to understand <em>why</em> the answers were correct.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Instead of just solving puzzles, this app takes a different approach: we ask AI models to <strong>explain</strong> why 
              the correct answers are correct. The results are eye-opening—if AI can't even articulate the reasoning behind 
              known solutions, what hope does it have of solving novel problems?
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">Open Source</Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700">Accessibility First</Badge>
              <Badge variant="outline" className="bg-purple-50 text-purple-700">AI Research</Badge>
              <Badge variant="outline" className="bg-orange-50 text-orange-700">Hobby Project</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Why This Matters */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Heart className="h-6 w-6 text-red-500" />
              Why Accessibility Matters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              My dad is one of the smartest people I know, but colorblindness turns half of these grids into a monochrome blur. 
              My nephew dreams of running mission control for rocket ships, but he inherited that same colorblindness. 
              He'll need the fluid intelligence skills these puzzles can build, and I don't want accessibility barriers to stop him.
            </p>
            <p className="text-gray-700 leading-relaxed">
              That's why this app replaces colors with <strong>emojis</strong>. The grids stay playful, the logic stays intact, 
              and anyone—colorblind, math-shy, or simply curious—can explore the kind of reasoning that currently eludes AI.
            </p>
          </CardContent>
        </Card>

        {/* Technology Stack */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Code className="h-6 w-6 text-green-600" />
              Technology & Open Source
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              This project is built with modern web technologies including React, TypeScript, TailwindCSS, 
              shadcn/ui components, PostgreSQL, and Express. It integrates with multiple AI providers 
              (OpenAI, Anthropic, Google Gemini, DeepSeek, and more) to test their reasoning capabilities.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex items-center gap-2">
                <a 
                  href="https://github.com/82deutschmark/arc-explainer" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Github className="h-5 w-5" />
                  View on GitHub
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="flex items-center gap-2">
                <a 
                  href="https://www.arxiv.org/pdf/2505.11831" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <BookOpen className="h-5 w-5" />
                  ARC2 Research Paper
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Acknowledgments */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Users className="h-6 w-6 text-purple-600" />
              Acknowledgments & Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">François Chollet & The ARC Prize Team</h4>
                <p className="text-sm text-gray-600">
                  For creating the ARC-AGI challenge and pushing the boundaries of what we understand about 
                  machine intelligence and reasoning.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">The Open Source Community</h4>
                <p className="text-sm text-gray-600">
                  This project stands on the shoulders of countless open-source contributors who built the 
                  amazing tools and libraries that make modern web development possible.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">AI Research Community</h4>
                <p className="text-sm text-gray-600">
                  For the ongoing work in understanding and improving AI reasoning capabilities, and for making 
                  these powerful models accessible through APIs.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">You!</h4>
                <p className="text-sm text-gray-600">
                  For exploring these puzzles, contributing feedback, and caring about accessibility and 
                  understanding in AI research.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Links */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">Get Involved</h3>
              <p className="text-gray-700">
                This is a hobby project with a small but dedicated community. Contributions, feedback, 
                and bug reports are always welcome!
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button asChild variant="outline" size="sm">
                  <a 
                    href="https://github.com/82deutschmark/arc-explainer/issues" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Github className="h-4 w-4" />
                    Report an Issue
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a 
                    href="https://github.com/82deutschmark" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Github className="h-4 w-4" />
                    Follow on GitHub
                  </a>
                </Button>
              </div>
              <p className="text-sm text-gray-600 pt-4">
                Made with <Heart className="h-4 w-4 inline text-red-500" /> by a hobbyist who just wanted 
                to understand some puzzles.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
