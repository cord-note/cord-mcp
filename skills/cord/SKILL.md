---
name: cord
description: How the Cord note app stores knowledge (vaults, notes, blocks, wiki links, tags with fields) and how to read and write Cord notes well. Use whenever the user mentions Cord, their Cord notes or vaults, or asks to save, find, organise, link or tag notes in Cord, with or without the Cord tools connected.
---

# Working with Cord

Cord is a local-first desktop note app. It is a knowledge graph, not a filing
cabinet: notes are small, linked with wiki links, and organised with tags that
can carry fields like a database.

## How Cord stores things

- **Vault**: a separate notebook (for example "Work", "Private"). Every note,
  tag and link belongs to one vault. Links and tags never cross vaults.
- **Note**: a title plus a document. Two kinds share one format:
  - `note`: quick, simple capture.
  - `notepad`: a Notion-style page of addressable blocks.
- **Block**: each top-level piece of a note (a paragraph, a heading, a whole
  list, a table, a code block...) has a stable id. A whole list is one block;
  single bullets can't be tagged.
- **Wiki link**: `[[Title]]` inside text links to the note with that title in
  the same vault. Cord derives backlinks from these; there is no other way to
  link notes.
- **Tag**: a label on a note or on a single block. A tag can have **fields**,
  which turn everything tagged into rows of a table:
  `text`, `number`, `checkbox`, `select`, `multi_select`, `date` (YYYY-MM-DD).
  For example a `task` tag with `Status` (select) and `Due` (date).
- **Views**: a tag's rows shown as a table or a board, also embeddable in a
  note. Agents can read the rows but not change views or field definitions.
- **Trash**: deleting moves a note to the trash. Nothing is ever deleted for
  good by an agent.

## Writing notes Cord renders well

Cord takes Markdown as input and turns it into its own format at once.

Supported:
- `#` to `######` headings, paragraphs, `---`
- `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `[text](https://...)`
- `-` and `1.` lists, task lists `- [ ] todo` / `- [x] done`
- `> quotes`, fenced code blocks with a language (```` ```rust ````)
- tables (`| a | b |` with a `|---|---|` row)
- math: `$x^2$` inline, `$$ ... $$` as a block
- wiki links `[[Title]]` and `[[Title|shown text]]`

Not supported through Markdown: images, embeds and tag views. Leave them out
or describe them in words.

Rules that matter:
- A wiki link only becomes a link when a note with that title already exists
  in the same vault (case doesn't matter). Otherwise it stays plain text. Make
  the target note first, or search to check the exact title.
- Don't write the note's title as a `#` heading at the top. The title is
  separate.
- When you read a note, each block ends with `^blockId`. Use those ids to tag
  or set fields on a block. Never write `^ids` yourself; Cord makes them.

Good Cord notes:
- One topic per note, with a short title that is easy to link to.
- Link related notes with `[[...]]` instead of repeating their content.
- Use tags for what a note is (`meeting`, `idea`, `task`) and fields for
  structured facts (status, dates, people), not prose.
- Use task lists for to-dos.

## With the Cord tools connected

The tools work only while Cord is open and unlocked, and only on the vaults
the user picked in Cord's **Agents** tab.

Read:
- `list_vaults`: find the vault id first.
- `search` (`query`, optional `vaultId`): find notes by words; then
- `read_note` (`noteId`): title, tags, field values and the text as Markdown.
- `backlinks` (`noteId`), `list_tags` (`vaultId`), `tag_table` (`tagId`).

Write (only when the user turned on **Agents can edit**; otherwise these tools
are missing):
- `create_note` (`vaultId`, `title`, optional `markdown`, optional `tags` as
  names; missing tags are created)
- `append_to_note` (`noteId`, `markdown`): adds to the end. There is no tool to
  rewrite or delete text inside a note, so don't promise that.
- `tag` / `untag` (`targetId` = note id or block id, `tag` = name)
- `set_field` (`fieldId` from `list_tags`, `targetId`, `value`; `null` clears;
  select values are option ids, not labels)
- `move_to_trash` (`noteId`)

Before writing: search for an existing note to append to, rather than making
duplicates. Tell the user what you created or changed.

Messages you may see:
- "Cord is locked or closed": ask the user to open and unlock Cord.
- "Cord refused the token": the user needs a fresh token from the Agents tab.
- "not found" for something that exists: it is in a vault agents can't see.

## Without the Cord tools

You can still write notes for Cord. Give each note as:

1. the **title** on its own line, then
2. the **body** as Markdown in a code block, following the rules above.

The user pastes the body into a new Cord note, and Cord turns the Markdown into
rich text. When notes should link to each other, list them so the linked-to
notes are created first, and use their exact titles in `[[...]]`. Suggest tags
and field values in a short line after each note, since pasting doesn't set
them.

If the user wants the tools, they need a Cord version with the Agents tab:
there they allow agents, pick vaults, and make a token for this plugin.
