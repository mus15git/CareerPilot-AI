/**
 * inspect-links.js
 * Inspects URI link annotations in a PDF by parsing raw PDF structure.
 * Works without needing pdf-lib's complex page API.
 * 
 * Run: node inspect-links.js link-fix-test.pdf
 */

const fs = require('fs');
const path = require('path');

const pdfPath = process.argv[2] || path.join(__dirname, 'link-fix-test.pdf');

if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`);
    process.exit(1);
}

const buf = fs.readFileSync(pdfPath);
const text = buf.toString('latin1'); // use latin1 to preserve all bytes

// Extract all URI values from /URI (...) entries in PDF annotations
const uriRegex = /\/URI\s*\(([^)]+)\)/g;
const found = [];
let m;
while ((m = uriRegex.exec(text)) !== null) {
    found.push(m[1]);
}

console.log(`\nFile: ${path.basename(pdfPath)}`);
console.log(`Size: ${Math.round(buf.length / 1024)} KB`);
console.log(`\nLink annotations found: ${found.length}`);

if (found.length === 0) {
    console.log('\n⚠ No link annotations detected in the PDF.');
    console.log('  This may indicate that Puppeteer did not embed clickable links.');
    console.log('  Try: check that <a href="..."> tags are in the HTML before PDF generation.');
} else {
    console.log('\nAll URLs:');
    found.forEach((url, i) => {
        const decoded = url.replace(/#([0-9A-Fa-f]{2})/g, (_, hex) => 
            String.fromCharCode(parseInt(hex, 16)));
        console.log(`  [${i + 1}] ${decoded}`);
    });
}

// Classification summary
console.log('\n=== Link Verification Summary ===');
const checks = [
    { name: 'LinkedIn',  pattern: /linkedin\.com/i },
    { name: 'GitHub',    pattern: /github\.com/i },
    { name: 'LeetCode',  pattern: /leetcode\.com/i },
    { name: 'Portfolio', pattern: /johndoe\.dev|vercel\.app|netlify\.app|\.dev/i },
    { name: 'Email',     pattern: /mailto:/i },
];
for (const c of checks) {
    const match = found.find(u => c.pattern.test(u));
    if (match) {
        console.log(`  ${c.name.padEnd(10)} ✓ CLICKABLE — ${match}`);
    } else {
        console.log(`  ${c.name.padEnd(10)} ✗ NOT FOUND as annotation`);
    }
}
