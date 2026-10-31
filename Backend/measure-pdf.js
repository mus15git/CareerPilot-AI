require("dotenv").config({ path: "./.env" });
const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const interviewReportModel = require("./src/models/interviewReport.model");
const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
});

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    const report = await interviewReportModel.findOne().sort({ createdAt: -1 });
    if (!report) {
        console.log("No report found");
        process.exit(1);
    }

    // Generate HTML from AI (mocking generateResumePdf)
    const prompt = `Generate resume for a candidate with the following details:
        Resume: ${report.resume}
        Self Description: ${report.selfDescription}
        Job Description: ${report.jobDescription}

        the response should be a JSON object with a single field "html" which contains the HTML content...
    `;

    // For speed, let's just use dummy HTML that mimics the resume structure
    const html = `
        <h1>John Doe</h1>
        <h2>Summary</h2>
        <p>Software Engineer with 5 years experience...</p>
        <h2>Technical Skills</h2>
        <p>React, Node.js, Python, MongoDB</p>
        <h2>Experience</h2>
        <p>Software Engineer at Google</p>
        <h2>Key Projects</h2>
        <p>AI Resume Generator</p>
        <h2>Achievements</h2>
        <p>Winner of Hackathon</p>
        <h2>Education</h2>
        <p>BS Computer Science</p>
    `;

    const compactStyles = `
        <style>
            /* Enforce compact 1-page A4 resume styles */
            body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                font-size: 10pt !important;
                line-height: 1.25 !important;
                color: #222 !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            h1, h2, h3, h4, h5, h6 {
                margin-top: 6px !important;
                margin-bottom: 2px !important;
                line-height: 1.1 !important;
                page-break-after: avoid !important;
            }
            h1 { font-size: 15pt !important; margin-top: 0 !important; }
            h2 { 
                font-size: 12pt !important; 
                border-bottom: 1px solid #ddd !important; 
                padding-bottom: 1px !important;
                margin-top: 8px !important;
            }
            h3 { font-size: 10.5pt !important; }
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
            }
            div, section, article {
                /* Allow natural page breaks */
                page-break-inside: auto !important;
            }
        </style>
    `;

    const styledHtml = compactStyles + html;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(styledHtml, { waitUntil: "networkidle0" });

    // Evaluate height
    const height = await page.evaluate(() => document.body.scrollHeight);
    console.log("Rendered HTML height in pixels:", height);

    // Generate PDF to observe
    await page.pdf({
        path: "test-verified.pdf",
        format: "A4", margin: {
            top: "8mm",
            bottom: "8mm",
            left: "10mm",
            right: "10mm"
        }
    });

    console.log("PDF generated at test-verified.pdf. A4 max height is approx 1062px for one page.");
    await browser.close();
    process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
