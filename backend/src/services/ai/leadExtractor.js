import pdfParse from 'pdf-parse'
import OpenAI from 'openai'
import { logger } from '../../utils/logger.js'

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

const SYSTEM_PROMPT = `You are an expert CRM Data Extraction Assistant.
Your task is to analyze document text (which may contain client lists, lead forms, contact tables, or business quotes) and extract all valid lead entries.

For each lead record, extract the following fields:
- name: Full name of customer/lead
- phone: Primary phone number
- second_phone: Alternative or secondary phone number
- email: Email address
- designation: Profession, title, or job role
- company: Company name, business name, or project interest
- source: Lead source if mentioned (e.g., Facebook, Referral, Event, Web), otherwise leave ""
- status: Default to "Fresh Lead" unless specified
- location: City or region
- area: Specific area or neighborhood
- address: Full street address
- priority: "High", "Medium", or "Low" (default "Medium")
- description: Notes, requirements, comments, flat preference, budget, or key details found

Respond strictly with a JSON object in the following structure:
{
  "leads": [
    {
      "name": "John Doe",
      "phone": "01712345678",
      "second_phone": "",
      "email": "john@example.com",
      "designation": "Software Engineer",
      "company": "Tech Corp",
      "source": "",
      "status": "Fresh Lead",
      "location": "Dhaka",
      "area": "Gulshan",
      "address": "Road 12, Block B",
      "priority": "High",
      "description": "Interested in 3BHK luxury apartment"
    }
  ]
}

CRITICAL RULES:
1. Extract EVERY distinct lead contact from the document.
2. Clean up names, phone numbers, and formatting.
3. If a field is not found for a lead, set its value to empty string "".
4. Return ONLY valid JSON with no markdown syntax outside.`

export async function extractLeadsFromPdfBuffer(buffer) {
  if (!openai) {
    throw new Error('OPENAI_API_KEY is not configured on the server.')
  }

  try {
    // 1. Extract text from PDF
    const pdfData = await pdfParse(buffer)
    const rawText = pdfData.text ? pdfData.text.trim() : ''

    if (!rawText || rawText.length < 10) {
      throw new Error('Could not extract text from the PDF. Ensure the file contains selectable text.')
    }

    logger.info({ charCount: rawText.length, numPages: pdfData.numpages }, 'Extracting leads from PDF text')

    // Truncate rawText if excessively long to fit in context window comfortably
    const maxChars = 40000
    const textToProcess = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText

    // 2. Call OpenAI API
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Please extract all lead entries from the following text:\n\n${textToProcess}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 3000
    })

    const content = response.choices[0]?.message?.content || '{}'
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      logger.error({ content, err: e }, 'Failed to parse JSON response from OpenAI')
      throw new Error('Invalid response received from AI extraction engine.')
    }

    const leads = Array.isArray(parsed.leads) ? parsed.leads : []
    logger.info({ extractedCount: leads.length }, 'Successfully extracted leads from PDF')

    return leads
  } catch (err) {
    logger.error({ err }, 'Error in extractLeadsFromPdfBuffer')
    throw err
  }
}
