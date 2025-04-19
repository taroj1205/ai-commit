import { existsSync } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { GoogleGenerativeAI } from "@google/generative-ai"
import {
  BRANCH_RULES,
  BRANCH_TYPES,
  COMMIT_RULES,
  COMMIT_TYPES,
  DEFAULT_BRANCH_PROMPT,
  DEFAULT_PROMPT,
} from "../commands/prompt"
import type { BranchType, CommitType, Config } from "./config"
import { CONFIG_PATH } from "./config"

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

const generateBranchPrompt = (
  prompt: string,
  { locale = "en", type = "", maxLength = "50" }: Config,
) => {
  const replacements: Record<string, string> = {
    locale,
    maxLength,
    branchType: BRANCH_TYPES[type as BranchType],
    branchRule: BRANCH_RULES[type as BranchType] ?? "<branch name>",
  }

  return prompt.replace(/{{\s*(\w+)\s*}}/g, (_, key) => replacements[key] || "")
}

export type GenerateBranchNameParameters = Config & {
  diff: string
}

export const generateBranchNames = async ({
  apiKey,
  generate = "1",
  locale,
  // timeout = "10000",
  type,
  model = "gemini-2.0-flash",
  maxLength,
  diff,
}: GenerateBranchNameParameters): Promise<string[]> => {
  try {
    //   const isExists = existsSync(path.join(CONFIG_PATH, "prompt"))
    let prompt: string = DEFAULT_BRANCH_PROMPT

    // TODO: implement custom prompt
    //   if (isExists)
    //     prompt = await readFile(path.join(CONFIG_PATH, "prompt"), "utf-8")

    const messages = [
      {
        role: "user",
        parts: [
          { text: generateBranchPrompt(prompt, { locale, type, maxLength }) },
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
    let branchNames: string[] = []
    if (result.response && result.response.candidates) {
      branchNames = result.response.candidates
        .map((c: any) => c.content?.parts?.[0]?.text?.replace(/^"|"$/g, ""))
        .filter(Boolean)
    } else if (result.response?.text) {
      branchNames = [result.response.text().replace(/^"|"$/g, "")]
    }

    branchNames = Array.from(new Set(branchNames))

    return branchNames
  } catch (e: any) {
    if (e?.response?.status >= 400 && e?.response?.status < 600) {
      throw new Error(`Gemini API Error: ${e.message}`)
    } else if (e instanceof Error) {
      throw new Error(e.message)
    }
    return []
  }
}

export type GenerateCommitMessagesParameters = Config & {
  diff: string
}

export const generateCommitMessages = async ({
  apiKey,
  generate = "1",
  locale,
  // timeout = "10000",
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
