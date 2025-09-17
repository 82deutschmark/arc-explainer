Comprehensive Implementation Plan
Task 1: Database Integration - Auto-Feedback for BOTH_BAD 🔧
Goal: When user selects BOTH_BAD, automatically add "not_helpful" feedback to both explanations

Implementation:

Modify 
EloRepository.recordVote()
 to insert feedback records when outcome === 'BOTH_BAD'
Add two INSERT statements to the feedback table with feedback_type = 'not_helpful'
This leverages existing feedback infrastructure
Task 2: UI logic - Hide Elements in Comparison Mode 🎨
Goal: Unbiased comparison interface by hiding non-essential elements.  PuzzleID and Confidence are the only two to show.  We reveal them in the results modal.

Elements to Hide:

Feedback summary badges ("X helpful, Y not helpful")
Date/time badges
Model cost information

Implementation:

Update 
AnalysisResultHeader
 props to respect comparisonMode
Conditionally render feedback summary, date, time badges
Task 3: Post-Vote Results Modal 🖼️
Goal: Show stats reveal after vote submission

Modal Contents:

┌─────────────────────────────────────────────────┐
│  🎯 Vote Recorded! Here's What Was Actually     │
│      Correct vs What You Just Evaluated        │
├─────────────────────────────────────────────────┤
│                                                 │
│  ✅ Correct Answer:     🤖 Your Evaluation:     │
│  [Actual Grid]          Model A: [Name]         │
│                         Model B: [Name]         │
│                         Your Choice: [Outcome]   │
│                                                 │
│  📊 Quick Stats:                                │
│  • Model A Accuracy: XX%                       │
│  • Model B Accuracy: XX%                       │
│  • Your Vote: [Explanation]                    │
│                                                 │
│           [Continue to Next Comparison]          │
└─────────────────────────────────────────────────┘
Task 4: UX Flow Integration 🔄
Goal: Seamless flow from vote → reveal → advance

Current Flow: Vote → "Vote Recorded!" → Auto-advance

New Flow: Vote → Modal with Results → User closes OR auto-close → Auto-advance

State Management:

showResultsModal: boolean
voteResult: VoteResponse & { correctGrid, modelAccuracy }
Task 5: Data Integration 📊
Goal: Provide stats context in the modal

Required Data: (ALL EXISTS IN THE PROJECT!!!  CHECK HOW OTHER PAGES DO EACH ONE.  ASK THE USER BEFORE YOU DECIDE YOU NEED TO WRITE NEW STUFF!!  This is just hooking up existing code from other files correctly.  Not inventing or sourcing anything new.)

Correct output grid from puzzle data
Model accuracy percentages (find in repos and hooks or whatever the rest of the project uses)
Model names (all data)
