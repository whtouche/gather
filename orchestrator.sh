#!/bin/bash

# Orchestrator Script for Gather App Development
# This script launches three sequential Claude Code instances:
# 1. Implementer: Claims and implements the next unclaimed roadmap task
# 2. Reviewer: Reviews code, fixes issues, writes tests
# 3. Finalizer: Commits, updates documentation, pushes to GitHub

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROADMAP_FILE="$PROJECT_DIR/openspec/ROADMAP.md"
LOG_DIR="$PROJECT_DIR/.orchestrator-logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create log directory
mkdir -p "$LOG_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Gather App Orchestrator${NC}"
echo -e "${BLUE}  $(date)${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if roadmap exists
if [ ! -f "$ROADMAP_FILE" ]; then
    echo -e "${RED}Error: Roadmap file not found at $ROADMAP_FILE${NC}"
    exit 1
fi

# ============================================
# PHASE 1: IMPLEMENTER
# ============================================
echo -e "\n${YELLOW}Phase 1: Implementer Agent${NC}"
echo -e "${YELLOW}Finding and implementing next unclaimed task...${NC}\n"

IMPLEMENTER_LOG="$LOG_DIR/implementer_${TIMESTAMP}.log"

IMPLEMENTER_PROMPT='You are the Implementer agent for the Gather app project.

Your job is to:
1. Read the roadmap at openspec/ROADMAP.md
2. Find the next unclaimed task (a task without [DONE] or [IN PROGRESS] markers)
   - Tasks are organized in Groups (A, B, C, D, etc.) that must be done in order
   - Within a group, all tasks can be done in parallel, but pick just ONE task
   - A group can only be started if the previous group is marked [DONE]
3. Mark that specific task as [IN PROGRESS] in the roadmap file
4. Implement the task fully:
   - Read relevant spec files in openspec/specs/
   - Implement backend changes in backend/
   - Implement frontend changes in frontend/
   - Follow existing code patterns and conventions
5. Run TypeScript checks: npx tsc --noEmit in both backend and frontend directories
6. Fix any TypeScript errors before completing

IMPORTANT:
- Only claim ONE task, not an entire group
- Update the roadmap to mark your specific task as [IN PROGRESS] before starting
- If all tasks in the current eligible group are done or in progress, report that and exit
- Do NOT commit any changes - that will be done by a later agent

Output a summary of what you implemented when done.'

claude --dangerously-skip-permissions --print "$IMPLEMENTER_PROMPT" 2>&1 | tee "$IMPLEMENTER_LOG"

IMPLEMENTER_EXIT=$?
if [ $IMPLEMENTER_EXIT -ne 0 ]; then
    echo -e "${RED}Implementer agent failed with exit code $IMPLEMENTER_EXIT${NC}"
    exit 1
fi

echo -e "\n${GREEN}Phase 1 Complete: Implementation done${NC}"

# ============================================
# PHASE 2: REVIEWER
# ============================================
echo -e "\n${YELLOW}Phase 2: Reviewer Agent${NC}"
echo -e "${YELLOW}Reviewing code, fixing issues, writing tests...${NC}\n"

REVIEWER_LOG="$LOG_DIR/reviewer_${TIMESTAMP}.log"

REVIEWER_PROMPT='You are the Reviewer agent for the Gather app project.

Your job is to:
1. Check git status to see what files were changed
2. Review all changed/new files for:
   - Code quality and best practices
   - Security issues (SQL injection, XSS, etc.)
   - TypeScript type safety
   - Consistency with existing code patterns
   - Missing error handling
3. Fix any issues you find
4. Write tests for the new functionality:
   - Backend: Create test files in backend/src/__tests__/ or alongside the files
   - Frontend: Create test files using React Testing Library patterns
5. Run TypeScript checks again to ensure everything compiles
6. If there are existing test commands in package.json, try running them

IMPORTANT:
- Focus on the files that were recently changed (check git status/diff)
- Do NOT commit changes - that will be done by a later agent
- If you find critical issues that prevent the feature from working, fix them

Output a summary of:
- Issues found and fixed
- Tests written
- Any remaining concerns'

claude --dangerously-skip-permissions --print "$REVIEWER_PROMPT" 2>&1 | tee "$REVIEWER_LOG"

REVIEWER_EXIT=$?
if [ $REVIEWER_EXIT -ne 0 ]; then
    echo -e "${RED}Reviewer agent failed with exit code $REVIEWER_EXIT${NC}"
    exit 1
fi

echo -e "\n${GREEN}Phase 2 Complete: Review and tests done${NC}"

# ============================================
# PHASE 3: FINALIZER
# ============================================
echo -e "\n${YELLOW}Phase 3: Finalizer Agent${NC}"
echo -e "${YELLOW}Committing, updating docs, and pushing...${NC}\n"

FINALIZER_LOG="$LOG_DIR/finalizer_${TIMESTAMP}.log"

FINALIZER_PROMPT='You are the Finalizer agent for the Gather app project.

Your job is to:
1. Check git status to see all changes
2. Review the roadmap at openspec/ROADMAP.md to find which task was marked [IN PROGRESS]
3. Update that task from [IN PROGRESS] to [DONE]
4. If ALL tasks in a group are now [DONE], also mark the group header as [DONE]
5. Stage all changes with git add
6. Create a descriptive commit message that:
   - Summarizes what was implemented
   - References the task ID (e.g., "D1: Email Invitations")
   - Mentions key files changed
   - Use conventional commit format: "feat(scope): description"
7. Commit the changes (include Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>)
8. Push to the remote repository (origin)

IMPORTANT:
- Make sure the roadmap is updated BEFORE committing
- Use a clear, descriptive commit message
- If push fails due to no remote or auth issues, report the error but still mark as complete locally

Output:
- The commit message used
- Confirmation of push status
- Updated status of the roadmap task'

claude --dangerously-skip-permissions --print "$FINALIZER_PROMPT" 2>&1 | tee "$FINALIZER_LOG"

FINALIZER_EXIT=$?
if [ $FINALIZER_EXIT -ne 0 ]; then
    echo -e "${RED}Finalizer agent failed with exit code $FINALIZER_EXIT${NC}"
    exit 1
fi

echo -e "\n${GREEN}Phase 3 Complete: Committed and pushed${NC}"

# ============================================
# SUMMARY
# ============================================
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}  Orchestration Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Logs saved to: $LOG_DIR"
echo -e "  - Implementer: $IMPLEMENTER_LOG"
echo -e "  - Reviewer: $REVIEWER_LOG"
echo -e "  - Finalizer: $FINALIZER_LOG"
echo ""
