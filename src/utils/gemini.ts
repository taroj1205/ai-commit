import { existsSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { COMMIT_RULES, COMMIT_TYPES, DEFAULT_PROMPT } from "../commands/prompt"
import { CONFIG_PATH, type CommitType, type Config } from "./config"

const generatePrompt = (
  prompt: string,
  { locale = "en", type = "", maxLength = "50" }: Config,
) => {
  const replacements: Record<string, string> = {
    locale,
    maxLength,
    commitType: COMMIT_TYPES[type as CommitType],
    commitRule: COMMIT_RULES[type as CommitType] ?? "<commit message>",
  }

  return prompt.replace(/{{\s*(\w+)\s*}}/g, (_, key) => replacements[key] || "")
}

export const generateBranchName = async ({
  apiKey,
  diff,
}: {
  apiKey: string
  diff: string
}): Promise<string> => {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro" })
  const prompt = `Suggest a concise, conventional git branch name (kebab-case, no spaces, no special characters) for the following changes:\n${diff}\nRespond with only the branch name.`
  const result = await model.generateContent(prompt)
  // Parse response, remove quotes/whitespace
  const branchName = result.response.text().replace(/["'\s]/g, "")
  return branchName
}

export type GenerateCommitMessagesParameters = Config & {
  diff: string
}

export const generateCommitMessages = async ({
  apiKey,
  generate = "1",
  locale,
  timeout = "10000",
  type,
  model = "gemini-2.0-flash",
  maxLength,
  diff,
}: GenerateCommitMessagesParameters): Promise<string[]> => {
  try {
    const isExists = existsSync(path.join(CONFIG_PATH, "prompt"))
    let prompt: string = DEFAULT_PROMPT

    if (isExists)
      prompt = await readFile(path.join(CONFIG_PATH, "prompt"), "utf-8")

    const messages = [
      {
        role: "user",
        parts: [
          { text: generatePrompt(prompt, { locale, type, maxLength }) },
          { text: diff },
        ],
      },
    ]

    const n = Number(generate)

    if (!apiKey) {
      throw new Error(
        "Please set your Gemini API key via `ai-commit config set apiKey=<your token>`",
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const geminiModel = genAI.getGenerativeModel({ model })

    // Gemini SDK expects an array of strings or parts
    const result = await geminiModel.generateContent({
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        topP: 1,
        candidateCount: n,
        maxOutputTokens: 200,
      },
    })

    // Extract and deduplicate messages
    let commitMessages: string[] = []
    if (result.response && result.response.candidates) {
      commitMessages = result.response.candidates
        .map((c: any) => c.content?.parts?.[0]?.text?.replace(/^"|"$/g, ""))
        .filter(Boolean)
    } else if (result.response?.text) {
      commitMessages = [result.response.text().replace(/^"|"$/g, "")]
    }

    commitMessages = Array.from(new Set(commitMessages))

    return commitMessages
  } catch (e: any) {
    if (e?.response?.status >= 400 && e?.response?.status < 600) {
      throw new Error(`Gemini API Error: ${e.message}`)
    } else if (e instanceof Error) {
      throw new Error(e.message)
    }
    return []
  }
}
