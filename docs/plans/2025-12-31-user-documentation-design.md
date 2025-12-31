# CanonCore User Documentation Design

> **For Claude:** Use docs-write skill to write user-facing documentation in Fumadocs.

**Goal:** Create comprehensive end-user documentation for CanonCore application users.

**Audience:** Non-technical users who want to organize their files and folders.

**Location:** `content/docs/` directory as MDX files for Fumadocs.

---

## Documentation Structure

```
content/docs/
├── index.mdx                    # Welcome & quick start
├── getting-started/
│   ├── create-account.mdx       # Sign up process
│   ├── sign-in.mdx              # How to sign in
│   └── quick-tour.mdx           # First steps walkthrough
├── account/
│   ├── password-reset.mdx       # Forgot password flow
│   ├── sign-out.mdx             # How to sign out
│   └── security.mdx             # Account security tips
├── files-and-folders/
│   ├── create-folder.mdx        # Creating new folders
│   ├── rename-items.mdx         # Renaming files/folders
│   ├── delete-items.mdx         # Deleting items
│   ├── organize.mdx             # Moving and nesting
│   └── navigation.mdx           # Breadcrumbs and navigation
├── views/
│   ├── tree-view.mdx            # Hierarchical tree view
│   ├── grid-view.mdx            # Card grid layout
│   └── drag-and-drop.mdx        # Reordering items
└── preferences/
    └── dark-mode.mdx            # Light/dark theme toggle
```

## Content Guidelines

### Tone

- Friendly and conversational
- Action-oriented (lead with what to do)
- Avoid technical jargon
- Use "you" to address the reader

### Format

- Short paragraphs
- Numbered steps for procedures
- Screenshots where helpful (describe in alt text)
- Bold for UI elements (**Create Folder**)

### Each Page Includes

1. Brief intro (1-2 sentences)
2. Step-by-step instructions
3. Tips or notes where relevant
4. Link to related topics

---

## Page Content Outlines

### index.mdx - Welcome

- What CanonCore is (file organization tool)
- Key features overview
- Quick links to get started

### getting-started/create-account.mdx

- Navigate to sign-up
- Fill in email and password
- Password requirements explained
- Confirmation and redirect

### getting-started/sign-in.mdx

- Navigate to sign-in
- Enter credentials
- What to do if you forget password

### files-and-folders/create-folder.mdx

- Click **Add Folder** button
- Enter folder name
- Create subfolders inside folders

### files-and-folders/organize.mdx

- Drag folders to reorder
- Nest folders inside other folders
- Use breadcrumbs to navigate back

### views/tree-view.mdx

- What tree view shows
- Expand/collapse folders
- When to use tree view

### views/grid-view.mdx

- What grid view shows
- Visual card layout
- When to use grid view

### preferences/dark-mode.mdx

- Find theme toggle in header
- Switch between light and dark
- System preference detection
