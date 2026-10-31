/**
 * test-link-fix.js
 * Tests the fixed social link substitution in postProcessResumeHtml.
 * Generates a PDF and inspects all link annotations.
 *
 * Run: node test-link-fix.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ─── 1. Import the functions under test ────────────────────────────────────────
// We need to require the module's private functions.
// Since they aren't exported, we inline the relevant parts here for testing.
// But we DO call generatePdfFromHtml which is the real pipeline entry.
const { generateResumePdf } = require('./src/services/ai.service');

// ─── 2. Sample resume text with real-looking profile links ────────────────────
const sampleResume = `
John Doe
Email: john.doe@gmail.com | Phone: +91-9876543210
LinkedIn: linkedin.com/in/johndoe-dev
GitHub: github.com/johndoe-dev
LeetCode: leetcode.com/u/johndoe_lc
Portfolio: johndoe.dev

SUMMARY
Experienced full-stack developer with 3 years of experience.

SKILLS
JavaScript, Node.js, React, MongoDB, Python

EXPERIENCE
Software Engineer | TechCorp | 2022-Present
- Built REST APIs using Node.js and Express
- Deployed microservices on AWS

EDUCATION
B.Tech Computer Science | IIT Delhi | 2022
`;

const sampleSelfDescription = `
I am a full-stack developer with expertise in Node.js and React.
My GitHub: github.com/johndoe-dev
My LinkedIn: linkedin.com/in/johndoe-dev
My LeetCode: leetcode.com/u/johndoe_lc
Portfolio: johndoe.dev
`;

const sampleJobDescription = `
Looking for a full-stack developer with Node.js and React experience.
Requirements: 2+ years, REST APIs, cloud deployment.
`;

// ─── 3. Test extractProfileLinks logic directly ───────────────────────────────
function normalizeUrl(url) {
    if (!url) return null;
    let cleaned = url.trim().replace(/[),;.\s]+$/, '');
    if (!cleaned) return null;
    if (/^(https?:|mailto:|tel:)/i.test(cleaned)) return cleaned;
    if (cleaned.startsWith('//')) return 'https:' + cleaned;
    return 'https://' + cleaned;
}

function extractProfileLinks({ resume = '', selfDescription = '' }) {
    const combined = `${selfDescription}\n${resume}`;
    const links = { linkedin: null, github: null, portfolio: null, leetcode: null };

    const linkedinMatch = combined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-%]+)(?:\/[^\s)\]|,>]*)? /i);
    if (linkedinMatch) links.linkedin = normalizeUrl(linkedinMatch[0].trim());

    // Retry without the trailing space requirement
    if (!links.linkedin) {
        const m = combined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%]+/i);
        if (m) links.linkedin = normalizeUrl(m[0]);
    }

    const githubMatch = combined.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-%]+)(?:\/[a-zA-Z0-9_\-%]+)?/i);
    if (githubMatch && !['features', 'pricing', 'about', 'join'].includes(githubMatch[1].toLowerCase())) {
        links.github = normalizeUrl(githubMatch[0]);
    }

    const leetcodeMatch = combined.match(/(?:https?:\/\/)?(?:www\.)?leetcode\.com\/(?:u\/)?([a-zA-Z0-9_\-%]+)(?:\/[^\s)\]|,>]*)?/i);
    if (leetcodeMatch && !['problemset', 'problems', 'contest', 'explore'].includes(leetcodeMatch[1].toLowerCase())) {
        links.leetcode = normalizeUrl(leetcodeMatch[0]);
    }

    const portfolioLabelMatch = combined.match(/(?:portfolio|website|site|personal\s*site)\s*(?::|—|-|\s)\s*(https?:\/\/[^\s)\]|,>]+|(?:www\.)?[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:dev|me|io|app|com|in|org|site|page|vercel\.app|netlify\.app)(?:\/[^\s)\]|,>]*)?)/i);
    if (portfolioLabelMatch) {
        links.portfolio = normalizeUrl(portfolioLabelMatch[1]);
    } else {
        const domainMatch = combined.match(/(?:https?:\/\/)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.(?:dev|me|vercel\.app|netlify\.app|page))(?:\/[^\s)\]|,>]*)?/i);
        if (domainMatch) links.portfolio = normalizeUrl(domainMatch[0]);
    }

    return links;
}

// ─── 4. Run the test ──────────────────────────────────────────────────────────
async function main() {
    console.log('\n============================');
    console.log('  Link Extraction Test');
    console.log('============================\n');

    // Step 1: Test link extraction
    const detected = extractProfileLinks({ resume: sampleResume, selfDescription: sampleSelfDescription });
    console.log('Detected profile links from sample data:');
    console.log('  LinkedIn  :', detected.linkedin  || '(none)');
    console.log('  GitHub    :', detected.github    || '(none)');
    console.log('  LeetCode  :', detected.leetcode  || '(none)');
    console.log('  Portfolio :', detected.portfolio || '(none)');

    // Step 2: Generate PDF through the real pipeline (calls Gemini AI)
    console.log('\n============================');
    console.log('  Generating PDF via AI...');
    console.log('============================\n');
    console.log('(This calls Gemini AI — may take 10-30s)\n');

    let pdfBuffer;
    try {
        pdfBuffer = await generateResumePdf({
            resume: sampleResume,
            selfDescription: sampleSelfDescription,
            jobDescription: sampleJobDescription
        });
    } catch (err) {
        console.error('PDF generation failed:', err.message);
        process.exit(1);
    }

    const outPath = path.join(__dirname, 'link-fix-test.pdf');
    fs.writeFileSync(outPath, pdfBuffer);
    console.log(`PDF saved to: ${outPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);

    // Step 3: Inspect link annotations using pdf-lib
    console.log('\n============================');
    console.log('  Inspecting PDF Annotations');
    console.log('============================\n');

    try {
        const { PDFDocument } = require('pdf-lib');
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        console.log(`PDF has ${pages.length} page(s)`);

        let linkCount = 0;
        const foundUrls = [];

        for (let pi = 0; pi < pages.length; pi++) {
            const page = pages[pi];
            const annotations = page.node.get(page.node.doc.context.obj('Annots'));
            if (!annotations) {
                console.log(`  Page ${pi + 1}: No annotations`);
                continue;
            }
            const annots = annotations.asArray ? annotations.asArray() : [];
            for (const annotRef of annots) {
                try {
                    const annot = pdfDoc.context.lookup(annotRef);
                    if (!annot) continue;
                    const subtype = annot.get(pdfDoc.context.obj('Subtype'));
                    if (subtype && subtype.toString() === '/Link') {
                        const action = annot.get(pdfDoc.context.obj('A'));
                        if (action) {
                            const uri = action.get(pdfDoc.context.obj('URI'));
                            if (uri) {
                                const url = uri.decodeText ? uri.decodeText() : uri.value;
                                linkCount++;
                                foundUrls.push({ page: pi + 1, url });
                                console.log(`  [Page ${pi + 1}] LINK: ${url}`);
                            }
                        }
                    }
                } catch (e) {
                    // skip malformed annotations
                }
            }
        }

        console.log(`\nTotal link annotations found: ${linkCount}`);

        // Step 4: Classify each detected URL
        console.log('\n============================');
        console.log('  Link Verification Summary');
        console.log('============================');

        const checks = [
            { name: 'LinkedIn',  expected: detected.linkedin,  pattern: /linkedin\.com/i },
            { name: 'GitHub',    expected: detected.github,    pattern: /github\.com/i },
            { name: 'LeetCode',  expected: detected.leetcode,  pattern: /leetcode\.com/i },
            { name: 'Portfolio', expected: detected.portfolio, pattern: /johndoe\.dev/i },
            { name: 'Email',     expected: null,               pattern: /mailto:/i },
        ];

        for (const check of checks) {
            const match = foundUrls.find(f => check.pattern.test(f.url));
            if (check.expected) {
                if (match) {
                    const correct = match.url === check.expected;
                    console.log(`  ${check.name.padEnd(10)} [${correct ? '✓ CORRECT' : '⚠ WRONG  '}] ${match.url}`);
                    if (!correct) console.log(`             Expected: ${check.expected}`);
                } else {
                    console.log(`  ${check.name.padEnd(10)} [✗ MISSING] Expected: ${check.expected}`);
                }
            } else if (check.name === 'Email') {
                if (match) {
                    console.log(`  ${check.name.padEnd(10)} [✓ PRESENT ] ${match.url}`);
                } else {
                    console.log(`  ${check.name.padEnd(10)} [- not found (may be plain text)]`);
                }
            }
        }

    } catch (inspectErr) {
        console.error('\nAnnotation inspection error:', inspectErr.message);
        console.log('(Install pdf-lib: npm install pdf-lib)');
    }

    console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
