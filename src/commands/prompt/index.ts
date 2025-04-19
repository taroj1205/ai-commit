import { existsSync } from "fs"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { execa } from "execa"
import type { BranchType, CommitType } from "../../utils/config"
import { CONFIG_PATH } from "../../utils/config"
import { prompts } from "../../utils/prompts"

export const COMMIT_RULES: Record<CommitType, string> = {
  conventional: "<type>(<optional scope>): <commit message>",
}
export const COMMIT_TYPES: Record<CommitType, string> = {
  conventional: [
    `Choose a type from the type-to-description JSON below that best describes the git diff:`,
    JSON.stringify(
      {
        docs: "Documentation only changes",
        style:
          "Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)",
        refactor: "A code change that neither fixes a bug nor adds a feature",
        perf: "A code change that improves performance",
        test: "Adding missing tests or correcting existing tests",
        build: "Changes that affect the build system or external dependencies",
        ci: "Changes to our CI configuration files and scripts",
        chore: "Other changes that don't modify src or test files",
        revert: "Reverts a previous commit",
        feat: "A new feature",
        fix: "A bug fix",
      },
      null,
      2,
    ),
  ].join("\n"),
}
export const DEFAULT_PROMPT = [
  "Generate a concise git commit message written in present tense for the following code diff with the given specifications below:",
  `Message language: {{ locale }}`,
  `Commit message must be a maximum of {{ maxLength }} characters.`,
  "Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit.",
  "{{ commitType }}",
  "The output response must be in format:",
  "{{ commitRule }}",
  "The commit message subject must start with a lower-case letter. Do not capitalize the first word.",
  "The commit message subject must be in the present tense. Do not use past tense.",
]
  .filter(Boolean)
  .join("\n")

export const BRANCH_RULES: Record<BranchType, string> = {
  conventional: "<type>/<short-description-with-kebab-case>",
}

export const BRANCH_TYPES: Record<BranchType, string> = {
  conventional: [
    `Choose a type from the type-to-description JSON below that best describes the git diff:`,
    JSON.stringify(
      {
        feat: "A new feature",
        fix: "A bug fix",
        docs: "Documentation only changes",
        style:
          "Changes that do not affect the meaning of the code (white-space, formatting, etc)",
        refactor: "A code change that neither fixes a bug nor adds a feature",
        perf: "A code change that improves performance",
        test: "Adding missing tests or correcting existing tests",
        build: "Changes that affect the build system or external dependencies",
        ci: "Changes to our CI configuration files and scripts",
        chore: "Other changes that don't modify src or test files",
        revert: "Reverts a previous commit",
      },
      null,
      2,
    ),
  ].join("\n"),
}

export const DEFAULT_BRANCH_PROMPT = [
  "Generate a concise and conventional git branch name for the following code diff with the given specifications below:",
  `Branch name must use only lowercase letters, numbers, and hyphens.`,
  `Use the format: {{ branchRule }}`,
  `Choose a type from the list: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.`,
  "The short description must be in kebab-case and summarize the changes.",
  "Exclude anything unnecessary such as translation or explanations. Respond with only the branch name.",
  "{{ branchType }}",
]
  .filter(Boolean)
  .join("\n")

const get = async () => {
  await prompts(async (p, s) => {
    s.start(`Getting the prompt`)

    const isExists = existsSync(path.join(CONFIG_PATH, "prompt"))

    if (isExists) {
      const { stdout } = await execa("cat", [path.join(CONFIG_PATH, "prompt")])

      s.stop(`Got the prompt`)

      p.note(stdout, "Prompt")
    } else {
      s.message(`Generating the prompt`)

      try {
        await writeFile(
          path.join(CONFIG_PATH, "prompt"),
          DEFAULT_PROMPT,
          "utf-8",
        )
      } catch (e) {
        if (e instanceof Error) {
          if ("code" in e && e.code === "ENOENT") {
            await mkdir(CONFIG_PATH, { recursive: true })

            await writeFile(
              path.join(CONFIG_PATH, "prompt"),
              DEFAULT_PROMPT,
              "utf-8",
            )
          } else {
            throw new Error(e.message)
          }
        }
      }

      const { stdout } = await execa("cat", [path.join(CONFIG_PATH, "prompt")])

      s.stop(`Generated the prompt`)

      p.note(stdout, "Prompt")
    }

    p.complete("Done")
  })
}

const set = async () => {
  await prompts(async (p, s) => {
    s.start(`Getting the prompt`)

    const isExists = existsSync(path.join(CONFIG_PATH, "prompt"))

    if (isExists) {
      s.stop(`Wrote the prompt`)

      await execa("vim", [path.join(CONFIG_PATH, "prompt")], {
        stdio: "inherit",
      })
    } else {
      s.message(`Generating the prompt`)

      try {
        await writeFile(
          path.join(CONFIG_PATH, "prompt"),
          DEFAULT_PROMPT,
          "utf-8",
        )
      } catch (e) {
        if (e instanceof Error) {
          if ("code" in e && e.code === "ENOENT") {
            await mkdir(CONFIG_PATH, { recursive: true })

            await writeFile(
              path.join(CONFIG_PATH, "prompt"),
              DEFAULT_PROMPT,
              "utf-8",
            )
          } else {
            throw new Error(e.message)
          }
        }
      }

      s.stop(`Wrote the prompt`)

      await execa("vim", [path.join(CONFIG_PATH, "prompt")], {
        stdio: "inherit",
      })
    }

    const { stdout } = await execa("cat", [path.join(CONFIG_PATH, "prompt")])

    p.note(stdout, "Prompt")

    p.complete("Done")
  })
}

const reset = async () => {
  await prompts(async (p) => {
    const shouldContinue = await p.confirm({
      message: "Are you sure you want to reset the prompt?",
    })

    if (p.isCancel(shouldContinue) || !shouldContinue) {
      p.done("Reset cancelled")

      return
    }

    try {
      await writeFile(path.join(CONFIG_PATH, "prompt"), DEFAULT_PROMPT, "utf-8")
    } catch (e) {
      if (e instanceof Error) {
        if ("code" in e && e.code === "ENOENT") {
          await mkdir(CONFIG_PATH, { recursive: true })

          await writeFile(
            path.join(CONFIG_PATH, "prompt"),
            DEFAULT_PROMPT,
            "utf-8",
          )
        } else {
          throw new Error(e.message)
        }
      }
    }

    p.note(DEFAULT_PROMPT, "Prompt")

    p.complete("Done")
  })
}

export default { get, set, reset }
