import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseExpertDoc,
  buildOverview,
  getExpertDoc,
  clearExpertCache,
  SECTION_SLUGS,
} from '../lib/expert-sections.js';
import { superHelp } from '../tools/info.js';

// Synthetic markdown for unit tests
const SYNTHETIC_MD = `---
name: test
---

# Title

Intro paragraph.

## CRITICAL WARNING ABOUT ZED/ZQ LANGUAGE

Warning content here.

## Core Knowledge

Core content here.
More core lines.

## Language Syntax Reference

Syntax content.
Line two.
Line three.
`;

describe('parseExpertDoc', () => {
  it('strips frontmatter and extracts preamble', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    expect(doc.preamble).toContain('# Title');
    expect(doc.preamble).toContain('Intro paragraph.');
    expect(doc.preamble).not.toContain('---');
    expect(doc.preamble).not.toContain('name: test');
  });

  it('splits sections on ## headings', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    expect(doc.sections).toHaveLength(3);
    expect(doc.sections[0].title).toBe('CRITICAL WARNING ABOUT ZED/ZQ LANGUAGE');
    expect(doc.sections[1].title).toBe('Core Knowledge');
    expect(doc.sections[2].title).toBe('Language Syntax Reference');
  });

  it('assigns explicit slugs from SECTION_SLUGS map', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    expect(doc.sections[0].slug).toBe('warning');
    expect(doc.sections[1].slug).toBe('core');
    expect(doc.sections[2].slug).toBe('syntax');
  });

  it('auto-generates slugs for unknown headings', () => {
    const md = `# Intro\n\n## Some New Feature\n\nContent.`;
    const doc = parseExpertDoc(md);
    expect(doc.sections[0].slug).toBe('some-new-feature');
  });

  it('includes ## heading in section content', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    expect(doc.sections[0].content).toMatch(/^## CRITICAL WARNING/);
    expect(doc.sections[0].content).toContain('Warning content here.');
  });

  it('counts lines correctly', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    // "Core content here.\nMore core lines." = 2 lines
    expect(doc.sections[1].lines).toBe(2);
  });

  it('handles markdown with no frontmatter', () => {
    const md = `# Title\n\n## Section One\n\nContent.`;
    const doc = parseExpertDoc(md);
    expect(doc.preamble).toBe('# Title');
    expect(doc.sections).toHaveLength(1);
  });

  it('handles markdown with no sections', () => {
    const md = `# Just a title\n\nSome content.`;
    const doc = parseExpertDoc(md);
    expect(doc.preamble).toContain('Just a title');
    expect(doc.sections).toHaveLength(0);
  });
});

describe('buildOverview', () => {
  it('includes preamble, warning, and core sections inline', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    const overview = buildOverview(doc);
    expect(overview).toContain('# Title');
    expect(overview).toContain('Warning content here.');
    expect(overview).toContain('Core content here.');
  });

  it('shows remaining sections in index table', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    const overview = buildOverview(doc);
    expect(overview).toContain('## Available Sections');
    expect(overview).toContain('`expert:syntax`');
    expect(overview).toContain('Language Syntax Reference');
  });

  it('does not duplicate warning/core in the index table', () => {
    const doc = parseExpertDoc(SYNTHETIC_MD);
    const overview = buildOverview(doc);
    // The index table should not include warning or core
    expect(overview).not.toContain('`expert:warning`');
    expect(overview).not.toContain('`expert:core`');
  });
});

describe('SECTION_SLUGS against real expert doc', () => {
  beforeEach(() => clearExpertCache());

  it('maps all expected headings to slugs', () => {
    const doc = getExpertDoc();
    const docSlugs = doc.sections.map(s => s.slug);

    // Every explicit slug should appear in the parsed doc
    for (const slug of Object.values(SECTION_SLUGS)) {
      expect(docSlugs).toContain(slug);
    }
  });

  it('has no duplicate slugs', () => {
    const doc = getExpertDoc();
    const slugs = doc.sections.map(s => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has a non-empty preamble', () => {
    const doc = getExpertDoc();
    expect(doc.preamble.length).toBeGreaterThan(0);
    expect(doc.preamble).toContain('SuperDB');
  });
});

describe('superHelp expert integration', () => {
  beforeEach(() => clearExpertCache());

  it('expert returns overview with sections index', () => {
    const result = superHelp('expert');
    expect(result.success).toBe(true);
    expect(result.content).toContain('SuperDB');
    expect(result.content).toContain('CRITICAL WARNING');
    expect(result.content).toContain('Core Knowledge');
    expect(result.content).toContain('Available Sections');
    expect(result.content).toContain('`expert:sql`');
    expect(result.sections).toBeDefined();
    expect(result.sections!.length).toBeGreaterThan(5);
    expect(result.web_url).toContain('/expert-guide');
  });

  it('expert overview is significantly smaller than full doc', () => {
    const overview = superHelp('expert');
    const full = superHelp('expert:all');
    expect(overview.content.length).toBeLessThan(full.content.length * 0.5);
  });

  it('expert:all returns full document', () => {
    const result = superHelp('expert:all');
    expect(result.success).toBe(true);
    expect(result.content).toContain('SuperDB');
    expect(result.content).toContain('Aggregate Functions');
    expect(result.content.length).toBeGreaterThan(10000);
    expect(result.sections).toBeUndefined();
  });

  it('expert:<slug> returns single section', () => {
    const result = superHelp('expert:sql');
    expect(result.success).toBe(true);
    expect(result.content).toContain('PostgreSQL');
    expect(result.content).not.toContain('Aggregate Functions');
    expect(result.web_url).toContain('/expert-guide');
  });

  it('expert:aggregates returns aggregates section', () => {
    const result = superHelp('expert:aggregates');
    expect(result.success).toBe(true);
    expect(result.content).toContain('Aggregate Functions');
    expect(result.content).toContain('count()');
  });

  it('expert:bogus returns error with available sections', () => {
    const result = superHelp('expert:bogus');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown expert section: bogus');
    expect(result.error).toContain('expert:sql');
    expect(result.error).toContain('expert:aggregates');
  });

  it('expert topic is case-insensitive', () => {
    const result = superHelp('Expert');
    expect(result.success).toBe(true);
    expect(result.content).toContain('Available Sections');
  });
});
