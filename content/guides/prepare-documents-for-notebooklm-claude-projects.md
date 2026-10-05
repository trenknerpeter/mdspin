---
title: "How to Prepare Documents for NotebookLM, Claude Projects & Custom GPTs"
description: "Get better answers from NotebookLM, Claude Projects, ChatGPT Projects and custom GPTs. See each tool's file limits, why they read your files as text, and how converting and merging documents into Markdown helps you fit more in and get more accurate results."
date: "2026-10-05"
author: "MDSpin Team"
tags: ["guide", "notebooklm", "claude", "chatgpt", "knowledge base"]
---

NotebookLM, Claude Projects, ChatGPT Projects and custom GPTs all promise the same thing: give the AI your documents once, then ask questions about them whenever you like. In practice, people run into the same two problems. They hit the file limit long before they run out of documents, and the answers are only as good as the text the tool managed to pull out of each file.

Both problems have the same fix: prepare the documents before you upload them.

## The Limits You'll Run Into

Every tool caps how many files you can add, and the caps are lower than most document collections:

| Tool | File limit | Notes |
|------|-----------|-------|
| **Custom GPTs** (ChatGPT) | [Up to 20 files](https://help.openai.com/en/articles/8554397-creating-and-editing-gpts) per GPT | Up to 512 MB each; text files capped at [2M tokens per file](https://help.openai.com/en/articles/8555545-file-uploads-faq) |
| **ChatGPT Projects** | [5 files](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) (Free), 25 (Go, Plus), 40 (Pro, Business, Enterprise, Edu) | Only 10 files can be uploaded at once |
| **Claude Projects** | No fixed count, but bounded by the context window; [30 MB per file](https://support.claude.com/en/articles/8241126-uploading-files-to-claude) | On paid plans, Claude [switches to retrieval (RAG) mode](https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects) as project knowledge approaches the limit |
| **NotebookLM** (now also called Gemini Notebook) | [50 sources](https://support.google.com/notebooklm/answer/16215270) on the free plan, more on paid plans | Each source up to 500,000 words or 200 MB |

*Limits as published in each provider's help center, October 2026. They change often, so check the linked pages.*

If you have 60 meeting notes, 30 policy documents or a quarter's worth of decks, you'll hit these caps quickly.

## Why "Text Only" Matters

Here's the part most people miss: these tools mostly work from the **text** of your files.

- In **custom GPTs and ChatGPT Projects**, files you add as knowledge are processed with [text-only retrieval](https://help.openai.com/en/articles/10416312-visual-retrieval-with-pdfs-faq), even PDFs. Reading visuals inside PDFs is an Enterprise feature that applies to files uploaded in a conversation.
- In **Claude Projects**, files get [text extraction only, except for PDFs](https://support.claude.com/en/articles/8241126-uploading-files-to-claude). For Word files and other non-PDF documents, embedded images aren't read.

So before anything clever happens, a parser turns each file into plain text. If the parser jumbles a table, loses the headings or merges slides together, the AI is answering from that damaged copy, and retrieval tends to surface the wrong passages.

## The Fix: Convert, Then Merge

Converting documents to Markdown first solves both problems at once.

**Better text.** Markdown keeps the structure as plain text: headings as `#`, lists as `-`, a clear divider between documents. When the tool splits your knowledge into chunks and searches it, those headings act as signposts, so the passage it retrieves is more likely to be the one you meant. (For the details, see [why Markdown is the best format for RAG](/guides/markdown-for-rag).)

**Fewer files.** Several related documents can become one well-organized Markdown file, with each original document under its own heading. Twenty meeting notes become one "Q3 meetings" file. Thirty policies become three files, one each for HR, IT and Finance. You stay under the file cap without leaving anything out.

## How to Do It with MDSpin

### Step 1: Group your documents by topic

Decide how you'll split them before converting: by project, by quarter, by department. Aim for groups you'd naturally ask about together. Mixing unrelated topics in one file makes retrieval less precise.

### Step 2: Convert a group

Open [MDSpin](/) and drop in the files for one group: PDFs, Word documents, PowerPoint decks, HTML pages or screenshots. With a free account you can convert up to 10 files at a time, each up to 20 MB.

### Step 3: Click "Merge All"

Once the files are converted, click **Merge All**. MDSpin combines them into a single Markdown file: each document starts with a heading named after the original file, and a `---` divider separates one document from the next. Use **Download** to save it.

Give your original files clear names before converting (`2026-09-14 Pricing review.docx` rather than `notes-final-v3.docx`). Those names become the headings, and the headings are how the AI tells you where an answer came from.

### Step 4: Upload to your tool

- **NotebookLM**: Markdown (`.md`) is a [supported source type](https://support.google.com/notebooklm/answer/16215270), so upload it directly.
- **Claude Projects / ChatGPT Projects / custom GPTs**: upload the file to the project's or GPT's knowledge. Markdown is plain text, so if a tool doesn't accept the `.md` extension, rename the file to `.txt`; the content is identical.

### Step 5: Ask questions that use the structure

- "Which document mentions the vendor shortlist? Quote the heading."
- "Summarize what changed between the July and September meeting notes."
- "List every policy that mentions remote work, by document."

## Tips for a Knowledge Base That Stays Useful

- **One topic per file.** A focused file retrieves better than one giant file of everything.
- **Put key facts in text.** These tools mostly can't see charts and images inside documents, so if a number matters, make sure it appears in the text. Deck-specific tips are in [how to use a PowerPoint deck with ChatGPT & Claude](/guides/use-powerpoint-with-chatgpt).
- **Resolve drafts first.** In Word files, MDSpin keeps the "all changes accepted" version and leaves comments out. More in [how to use Word documents with ChatGPT & Claude](/guides/use-word-documents-with-chatgpt).
- **Refresh, don't pile up.** When a document changes, re-convert its group and replace the old file rather than adding a second copy that contradicts the first.

## When You Outgrow Upload Limits

Re-uploading files by hand works for a handful of collections. If you're managing dozens, or want documents to flow in automatically, read [how to build a knowledge base from your own documents](/guides/build-ai-knowledge-base-from-documents). It covers keeping a living collection that AI tools can query directly.

## Try It with Your Documents

Drop a few related files into the converter below, merge them, and see how much cleaner your knowledge base gets. You can preview without signing up.
