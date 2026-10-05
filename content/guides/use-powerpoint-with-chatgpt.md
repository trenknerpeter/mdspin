---
title: "How to Use a PowerPoint Deck with ChatGPT & Claude"
description: "Get accurate answers from ChatGPT and Claude about your slides. Convert a PowerPoint deck into clean, slide-by-slide Markdown, speaker notes included, and stop the AI from losing track of which point belongs to which slide."
date: "2026-10-05"
author: "MDSpin Team"
tags: ["guide", "powerpoint", "pptx", "chatgpt", "claude"]
---

You drop a 30-slide strategy deck into ChatGPT and ask, "What did we commit to for Q2?" The answer mixes a bullet from slide 4 with a heading from slide 19, and it misses the detail that was only in the speaker notes.

Slides are built for presenting, not for reading. To get good answers about a deck, give the AI the deck's content as a plain, ordered document first.

## Why AI Struggles with Slide Decks

A `.pptx` file isn't one document. It's a ZIP archive with a separate XML file for every slide, every layout, every set of speaker notes, and every chart. On a slide, text sits in independent boxes positioned on a canvas. Nothing in the file says which box is the title, which bullet comes first, or which caption belongs to which picture. The order you see comes from where the boxes sit on the slide, not from the text itself.

When an AI tool reads a deck, it has to rebuild all of that. Three things commonly go wrong:

- **Slide boundaries blur.** Text from several slides ends up in one long stream, so the AI can't tell you *where* a point was made.
- **Speaker notes get separated or lost.** Notes are often where the real explanation lives ("we're cutting this because…"). If they're missing or detached from their slide, the AI loses the reasoning behind the bullets.
- **Visual-only content disappears.** Charts, diagrams and screenshots carry no text. If a key number only appears inside a chart, a text-based reader never sees it.

## What ChatGPT and Claude Do with a .pptx Today

- **ChatGPT** accepts PowerPoint files. But OpenAI's own documentation says it extracts the *text* from presentations, and that [images embedded in files other than PDFs are not processed](https://help.openai.com/en/articles/10029836-optimizing-file-uploads-in-chatgpt-enterprise). Reading visuals inside files is [limited to PDFs on ChatGPT Enterprise](https://help.openai.com/en/articles/10416312-visual-retrieval-with-pdfs-faq).
- **Claude** doesn't list PowerPoint among the document types you can upload. Its [supported list](https://support.claude.com/en/articles/8241126-uploading-files-to-claude) covers PDF, DOCX, CSV, TXT, HTML, ODT, RTF, EPUB, JSON and XLSX, and for non-PDF documents it extracts text only.

Either way, the AI ends up working from the deck's text. So the question is whether you control how that text is laid out, or leave it to a parser you can't see.

## Why a Slide-by-Slide Markdown File Works Better

Markdown is plain text with lightweight structure. A heading is `##`. A quote is `>`. A divider is `---`. For a deck, that's enough to keep exactly what the AI needs:

```markdown
## Slide 3: Q2 Priorities

Ship self-serve onboarding

Cut time-to-first-value to under 10 minutes

> **Speaker Notes:** Onboarding is the bottleneck — 60% of trials never finish setup.

---

## Slide 4: What We're Not Doing

Enterprise SSO moves to Q3
```

Every point is pinned to a numbered slide with its title. The notes sit right under the slide they explain. When you ask "What's on slide 4?" or "Why did we prioritize onboarding?", the AI can answer from the right place and cite it.

## How to Convert a PowerPoint Deck with MDSpin

### Step 1: Get the deck as a .pptx file

If you work in PowerPoint, you already have one. If the deck lives in **Google Slides**, choose **File → Download → Microsoft PowerPoint (.pptx)** first. Keynote users can export to PowerPoint the same way.

### Step 2: Drop it into the converter

Open [MDSpin](/) and drag the `.pptx` onto the converter. Files up to 20 MB are accepted. You can preview the result without an account; a free account gives you the full document.

### Step 3: Click Spin

MDSpin reads each slide in turn and writes it out as its own section:

- A `## Slide N: Title` heading, using the first line of text on the slide as the title
- The rest of the slide's text, one line per paragraph
- The slide's **speaker notes**, quoted directly underneath
- A `---` divider before the next slide

### Step 4: Skim the output

Read through quickly before you paste. Look for slides that came out empty or nearly empty: those are usually charts, diagrams or screenshots (more on that below).

### Step 5: Paste it into ChatGPT or Claude

Copy the Markdown and paste it into the chat, or download it as a `.md` file and attach that. Then ask your questions. Referring to slides by number works well: "Summarize slides 10–14" or "Which slide mentions pricing?"

## Handling Charts, Diagrams and Screenshots

Text extraction can't read a picture. If a slide's key message lives in a chart or an image:

1. **Add the number to the speaker notes** before converting. This is the most reliable fix, and it also makes the deck better for whoever presents it.
2. **Screenshot the slide and convert the image.** MDSpin also reads PNG and JPG screenshots and turns visible text, including simple tables, into Markdown. See our guide to [extracting text from a screenshot for ChatGPT](/guides/extract-text-from-screenshot-for-chatgpt).
3. **Upload the slide image to the chat alongside the Markdown**, if your AI tool accepts images, and ask about it directly.

## Prompts That Work Well with Converted Decks

- "Summarize this deck in five bullets. Cite the slide number for each."
- "List every commitment, date or owner mentioned, with the slide it's on."
- "What questions would a skeptical CFO ask about slides 6–9?"
- "Turn the speaker notes into a one-page memo."
- "Compare this deck to last quarter's deck (pasted below). What changed?"

The slide headings make citation easy, which in turn makes the answers easy to check.

## Beyond a Single Deck

If you regularly ask AI about the same decks, such as training material, sales playbooks or a product roadmap, convert them once and keep the Markdown. It's searchable, diff-able, and reusable in any AI tool. For a whole folder of documents, see [how to build a knowledge base from your own documents](/guides/build-ai-knowledge-base-from-documents), and for loading files into NotebookLM, Claude Projects or a custom GPT, see [how to prepare documents for AI knowledge tools](/guides/prepare-documents-for-notebooklm-claude-projects).

Working with Word files too? Read [how to use Word documents with ChatGPT & Claude](/guides/use-word-documents-with-chatgpt). For PDFs, see [how to convert PDFs for ChatGPT, Claude & Gemini](/guides/convert-pdf-for-chatgpt).

## Try It on Your Deck

Drop a `.pptx` into the converter below to get a clean, slide-by-slide Markdown version in seconds. You can preview it without signing up.
