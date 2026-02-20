import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = join(__dirname, '../../docs');

export interface ExpertSection {
  slug: string;
  title: string;
  content: string;
  lines: number;
}

export interface ParsedExpertDoc {
  preamble: string;
  sections: ExpertSection[];
}

/**
 * Explicit slug map for intuitive, stable slugs.
 * Keys are the exact ## heading text (without the ## prefix).
 */
export const SECTION_SLUGS: Record<string, string> = {
  'CRITICAL WARNING ABOUT ZED/ZQ LANGUAGE': 'warning',
  'Core Knowledge': 'core',
  'Language Syntax Reference': 'syntax',
  'PostgreSQL Compatibility & Traditional SQL': 'sql',
  'Practical Query Patterns': 'patterns',
  'Advanced SuperDB Features': 'advanced',
  'Debugging Tips': 'debugging',
  'Format Conversions': 'formats',
  'Key Differences from SQL': 'differences',
  'Pragmas': 'pragmas',
  'SuperDB Quoting Rules (Critical for Bash Integration)': 'quoting',
  'SuperDB Array Filtering (Critical Pattern)': 'arrays',
  'Aggregate Functions': 'aggregates',
};

/** Slugs that are always included inline in the overview. */
const OVERVIEW_SLUGS = ['warning', 'core'];

/**
 * Generate a slug from a heading by lowercasing and replacing non-alphanumeric runs with hyphens.
 */
function autoSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Strip YAML frontmatter (--- delimited) from markdown content.
 */
function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---')) return markdown;
  const endIdx = markdown.indexOf('---', 3);
  if (endIdx === -1) return markdown;
  return markdown.slice(endIdx + 3).replace(/^\n+/, '');
}

/**
 * Parse the expert markdown into preamble + sections split on ## headings.
 */
export function parseExpertDoc(markdown: string): ParsedExpertDoc {
  const stripped = stripFrontmatter(markdown);
  const lines = stripped.split('\n');

  let preamble = '';
  const sections: ExpertSection[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^## (.+)$/);
    if (match) {
      // Flush previous section
      if (currentTitle !== null) {
        const content = currentLines.join('\n').trim();
        const title = currentTitle;
        const slug = SECTION_SLUGS[title] ?? autoSlug(title);
        sections.push({ slug, title, content: `## ${title}\n\n${content}`, lines: content.split('\n').length });
      } else {
        // Everything before first ## is the preamble
        preamble = currentLines.join('\n').trim();
      }
      currentTitle = match[1];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Flush last section
  if (currentTitle !== null) {
    const content = currentLines.join('\n').trim();
    const title = currentTitle;
    const slug = SECTION_SLUGS[title] ?? autoSlug(title);
    sections.push({ slug, title, content: `## ${title}\n\n${content}`, lines: content.split('\n').length });
  } else {
    preamble = currentLines.join('\n').trim();
  }

  return { preamble, sections };
}

/**
 * Build the overview: preamble + inline sections (warning, core) + section index table.
 */
export function buildOverview(doc: ParsedExpertDoc): string {
  const parts: string[] = [];

  // Preamble
  if (doc.preamble) {
    parts.push(doc.preamble);
  }

  // Inline overview sections
  for (const slug of OVERVIEW_SLUGS) {
    const section = doc.sections.find(s => s.slug === slug);
    if (section) {
      parts.push(section.content);
    }
  }

  // Section index table
  const remaining = doc.sections.filter(s => !OVERVIEW_SLUGS.includes(s.slug));
  if (remaining.length > 0) {
    parts.push('## Available Sections\n');
    parts.push('Use `super_help` with topic `"expert:<slug>"` to read a specific section.\n');
    parts.push('| Slug | Section | Lines |');
    parts.push('|---|---|---|');
    for (const section of remaining) {
      parts.push(`| \`expert:${section.slug}\` | ${section.title} | ${section.lines} |`);
    }
  }

  return parts.join('\n\n');
}

// Lazy-cached parsed doc
let cachedDoc: ParsedExpertDoc | null = null;

/**
 * Get the parsed expert doc, lazily reading and caching the file.
 */
export function getExpertDoc(): ParsedExpertDoc {
  if (!cachedDoc) {
    const filepath = join(docsDir, 'superdb-expert.md');
    const markdown = readFileSync(filepath, 'utf-8');
    cachedDoc = parseExpertDoc(markdown);
  }
  return cachedDoc;
}

/**
 * Clear the cached expert doc (for tests).
 */
export function clearExpertCache(): void {
  cachedDoc = null;
}
