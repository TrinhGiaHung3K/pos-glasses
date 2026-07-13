# POS GLASSES Optic Bridge Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and validate a project-ready transparent PNG logo for the POS GLASSES optical-store POS system, supported by a premium brand-kit concept board.

**Architecture:** Generate a strategic 3 × 3 identity board for visual review, then generate a separate square Optic Bridge mark on a flat chroma-key background. Copy the mark into the project, remove the key to produce alpha transparency, and validate the output programmatically and visually.

**Tech Stack:** Built-in image generation, brandkit prompt framework, Python chroma-key helper, Pillow image inspection.

---

### Task 1: Prepare the destination

**Files:**
- Create: `frontend/assets/images/`

- [ ] **Step 1: Create the assets directory if it does not already exist**

Run: `New-Item -ItemType Directory -Force 'frontend/assets/images'`

Expected: The command succeeds and `frontend/assets/images/` is available without changing existing assets.

### Task 2: Generate the brand-kit overview

**Files:**
- Create: generated brand-kit overview under Codex generated-images storage

- [ ] **Step 1: Generate a 3 × 3 Optic Bridge brand-kit board**

Use the built-in image generator with the brand strategy, exact name `POS GLASSES`, dark green / teal / mint palette, and panels for the logo cover, construction geometry, POS sidebar application, retail receipt application, palette, typography, and icon system.

- [ ] **Step 2: Inspect the generated board**

Verify: the board is cohesive, all visible instances of `POS GLASSES` are spelled correctly, the mark is consistent across panels, the layout has usable negative space, and no copied or unrelated logo appears.

### Task 3: Generate the standalone Optic Bridge mark

**Files:**
- Create: generated logo source under Codex generated-images storage

- [ ] **Step 1: Generate the square logo source**

Use the built-in image generator with a perfectly flat `#ff00ff` chroma-key background. Generate only the Optic Bridge icon plus one clean `POS GLASSES` wordmark lockup, using teal and dark green with generous padding. Exclude shadows, reflections, gradients, watermarks, fake UI, and extraneous text.

- [ ] **Step 2: Inspect the source logo**

Verify: the bridge reads as a subtle scan/checkout path, the symbol is simple at small size, the text is spelled exactly `POS GLASSES`, and no magenta color appears in the logo itself.

### Task 4: Deliver and validate the transparent project asset

**Files:**
- Create: `frontend/assets/images/pos-glasses-optic-bridge-logo.png`

- [ ] **Step 1: Copy the selected generated source into the project**

Copy the selected source as an intermediate file under `frontend/assets/images/` without overwriting existing files.

- [ ] **Step 2: Remove the chroma-key background**

Run the installed helper with `--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`, writing `frontend/assets/images/pos-glasses-optic-bridge-logo.png`.

- [ ] **Step 3: Validate the delivered PNG**

Use Pillow to confirm the mode includes alpha, all four corner pixels are transparent, the file has non-transparent logo coverage, and no strong magenta fringe remains.

- [ ] **Step 4: Visually inspect the delivered PNG**

Confirm: the logo is balanced, readable, transparent, and still recognizable when viewed small.

### Task 5: Record the result

**Files:**
- Modify: `docs/superpowers/specs/2026-07-10-pos-glasses-optic-bridge-logo-design.md`

- [ ] **Step 1: Append the final asset location and generation details**

Record the saved project path, the selected prompt, use of the built-in generator, and verification result so future work can reproduce or revise the identity.

## Plan Self-Review

- Spec coverage: Tasks 2 through 4 cover the brand-kit board, standalone transparent asset, destination path, and all acceptance checks.
- Placeholder scan: no incomplete markers or undefined implementation details remain.
- Consistency: all tasks use the selected `POS GLASSES` Optic Bridge direction, `#ff00ff` as the removable key color, and the same final asset path.
