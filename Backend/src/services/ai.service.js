const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(interviewReportSchema),
        }
    })

    return JSON.parse(response.text)


}



function normalizeUrl(url) {
    if (!url) return null;
    let cleaned = url.trim().replace(/[),;.\s]+$/, '');
    if (!cleaned) return null;
    if (/^(https?:|mailto:|tel:)/i.test(cleaned)) {
        return cleaned;
    }
    if (cleaned.startsWith('//')) {
        return 'https:' + cleaned;
    }
    return 'https://' + cleaned;
}

function extractProfileLinks({ resume = '', selfDescription = '' }) {
    const combined = `${selfDescription}\n${resume}`;
    const links = {
        linkedin: null,
        github: null,
        portfolio: null,
        leetcode: null
    };

    const linkedinMatch = combined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_\-%]+)(?:\/[^\s)\]|,>]*)?/i);
    if (linkedinMatch) {
        links.linkedin = normalizeUrl(linkedinMatch[0]);
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
        if (domainMatch) {
            links.portfolio = normalizeUrl(domainMatch[0]);
        }
    }

    return links;
}

function isPlaceholderUrl(url) {
    if (!url) return true;
    const lower = url.toLowerCase().trim();
    return (
        lower === '#' ||
        lower.startsWith('javascript:') ||
        lower.includes('your-username') ||
        lower.includes('your_username') ||
        lower.includes('yourusername') ||
        lower.includes('[username]') ||
        lower.includes('example.com') ||
        lower.includes('your-profile') ||
        lower.includes('username-here')
    );
}
function postProcessResumeHtml(html, detectedLinks = {}) {
    if (!html) return html;

    let processed = html;

    // Helper: determine which detected platform URL should override an anchor's href,
    // based on the anchor's visible text content. We ALWAYS override for known platforms
    // so that AI-hallucinated or wrong URLs are replaced with the real detected URL.
    function getOverrideUrl(textLower) {
        if (textLower.includes('linkedin') && detectedLinks.linkedin) return detectedLinks.linkedin;
        if (textLower.includes('github') && detectedLinks.github) return detectedLinks.github;
        if (textLower.includes('leetcode') && detectedLinks.leetcode) return detectedLinks.leetcode;
        if ((textLower.includes('portfolio') || textLower.includes('website')) && detectedLinks.portfolio) return detectedLinks.portfolio;
        return null;
    }

    // 1. Process existing <a> tags:
    //    - Always substitute with detected URL when the visible text identifies a known platform.
    //    - For non-platform links, normalize hrefs (prepend https://) and strip placeholders.
    processed = processed.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, text) => {
        const hrefMatch = attrs.match(/href=(["'])(.*?)\1/i);
        if (!hrefMatch) return match;

        let href = hrefMatch[2].trim();
        const textLower = text.replace(/<[^>]*>/g, '').toLowerCase(); // strip inner tags before checking

        // Always prefer the real detected URL for known platforms (overrides AI hallucinations)
        const overrideUrl = getOverrideUrl(textLower);
        if (overrideUrl) {
            href = overrideUrl;
        } else if (isPlaceholderUrl(href)) {
            // Non-platform link with a placeholder: drop the anchor, keep visible text
            return text;
        }

        // Ensure scheme is present
        if (!/^(https?:|mailto:|tel:|#)/i.test(href)) {
            href = 'https://' + href;
        }

        let cleanAttrs = attrs.replace(/\s*href=(["'])(.*?)\1/i, '').trim();
        if (!/target=/i.test(cleanAttrs)) {
            cleanAttrs += ' target="_blank"';
        }
        if (!/rel=/i.test(cleanAttrs)) {
            cleanAttrs += ' rel="noopener noreferrer"';
        }

        return `<a href="${href}" ${cleanAttrs}>${text}</a>`;
    });

    // 2. Linkify unlinked profile names or bare URLs in the HTML (outside existing <a> tags)
    const platforms = [
        { key: 'linkedin', label: 'LinkedIn', nameRegex: /\bLinkedIn(?!\.com)\b/i, urlRegex: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-%]+(?:\/[^\s)\]|,><]*)?/i },
        { key: 'github', label: 'GitHub', nameRegex: /\bGitHub(?!\.com)\b/i, urlRegex: /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_\-%]+(?:\/[a-zA-Z0-9_\-%]+)?/i },
        { key: 'leetcode', label: 'LeetCode', nameRegex: /\bLeetCode(?!\.com)\b/i, urlRegex: /(?:https?:\/\/)?(?:www\.)?leetcode\.com\/(?:u\/)?[a-zA-Z0-9_\-%]+(?:\/[^\s)\]|,><]*)?/i },
        { key: 'portfolio', label: 'Portfolio', nameRegex: /\bPortfolio\b/i, urlRegex: null }
    ];

    const chunks = processed.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
    for (const { key, label, nameRegex, urlRegex } of platforms) {
        const url = detectedLinks[key];
        if (url) {
            const alreadyLinked = chunks.some((chunk, idx) => idx % 2 === 1 && chunk.includes(url));
            if (!alreadyLinked) {
                for (let i = 0; i < chunks.length; i += 2) {
                    if (urlRegex && urlRegex.test(chunks[i])) {
                        chunks[i] = chunks[i].replace(urlRegex, (matchedText) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${matchedText}</a>`);
                        break;
                    } else if (nameRegex && nameRegex.test(chunks[i])) {
                        chunks[i] = chunks[i].replace(nameRegex, `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
                        break;
                    }
                }
            }
        }
    }
    processed = chunks.join('');

    return processed;
}

async function generatePdfFromHtml(htmlContent, detectedLinks = {}) {
    const processedHtml = postProcessResumeHtml(htmlContent, detectedLinks);

    const compactStyles = `
        <style>
            /* Clean, professional A4 resume styles */
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                font-size: 10pt !important;
                line-height: 1.3 !important;
                color: #222 !important;
                margin: 0 !important;
                padding: 0 !important;
                background-color: #ffffff !important;
            }
            h1, h2, h3, h4, h5, h6 {
                line-height: 1.15 !important;
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
            h1 {
                font-size: 16pt !important;
                margin-top: 0 !important;
                margin-bottom: 3px !important;
            }
            h2 { 
                font-size: 11.5pt !important; 
                border-bottom: 1px solid #ddd !important; 
                padding-bottom: 1px !important;
                margin-top: 8px !important;
                margin-bottom: 3px !important;
            }
            h3 {
                font-size: 10pt !important;
                margin-top: 4px !important;
                margin-bottom: 2px !important;
            }
            p, ul, ol {
                margin-top: 0 !important;
                margin-bottom: 4px !important;
            }
            ul, ol {
                padding-left: 16px !important;
            }
            li {
                margin-bottom: 2px !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            div, section, article {
                page-break-inside: auto !important;
            }
            .container, .resume-container, main, #resume, .page {
                max-width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
            }
            header, .header {
                margin-bottom: 6px !important;
                padding-bottom: 4px !important;
            }
            .section, .resume-section, section {
                margin-bottom: 6px !important;
            }
            .item, .experience-item, .project-item, .education-item {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            /* Subtle, professional clickable link styles */
            a {
                color: #0969da !important;
                text-decoration: underline !important;
                text-decoration-color: #cbd5e1 !important;
                text-underline-offset: 2px !important;
            }
            a:hover {
                color: #0550ae !important;
                text-decoration-color: #0550ae !important;
            }
        </style>
    `;

    const styledHtml = processedHtml.includes('</head>')
        ? processedHtml.replace('</head>', compactStyles + '</head>')
        : processedHtml + compactStyles;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(styledHtml, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
            top: "8mm",
            bottom: "8mm",
            left: "10mm",
            right: "10mm"
        }
    });

    await browser.close();

    return pdfBuffer;
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    });

    const detectedLinks = extractProfileLinks({ resume, selfDescription });
    const detectedLinksSummary = Object.entries(detectedLinks)
        .filter(([_, url]) => url)
        .map(([platform, url]) => `- ${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${url}`)
        .join("\n") || "None explicitly extracted (check text)";

    const prompt = `Generate resume for a candidate with the following details:
Resume: ${resume}
Self Description: ${selfDescription}
Job Description: ${jobDescription}

the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
You can highlight the content using subtle accents or clean font styles, keeping the overall design simple, modern, and professional.
The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.

Candidate Profile Links Detected from Input:
${detectedLinksSummary}

Links & Contact Requirements:
- Render candidate profile links (LinkedIn, GitHub, Portfolio, LeetCode) as clickable HTML anchors: <a href="NORMALIZED_URL" target="_blank" rel="noopener noreferrer">Visible Label</a> (e.g. <a href="https://linkedin.com/in/username">LinkedIn</a>).
- Ensure all href attributes start with https://.
- If a URL was not provided in the candidate data, keep the visible text (if any) as plain text, and do NOT invent or hallucinate fake URLs.
- Preserve the candidate's actual URLs and profile usernames accurately.

Pagination & Content Completeness:
- The resume length should be natural based on candidate experience: 1 page when the content fits comfortably, or 2 pages when the content genuinely requires it.
- Do NOT delete, truncate, or omit education, projects, work experience, certifications, or technical skills merely to force the resume onto a single page.
- Do NOT make text unreasonably small. Maintain readable, professional font sizes and spacing.
- All relevant details from the candidate's profile and experience must be preserved.
`;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    });

    const jsonContent = JSON.parse(response.text);

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html, detectedLinks);

    return pdfBuffer;

}

module.exports = { generateInterviewReport, generateResumePdf }