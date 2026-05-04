import { NextResponse } from "next/server";

const getPriority = (line: string) => {
  if (/security|auth|token|password/i.test(line)) return "high";
  if (/bug|fix|error|refactor/i.test(line)) return "medium";
  return "low";
};

export async function POST(req: Request) {
  const { repo, token } = (await req.json()) as { repo?: string; token?: string };
  if (!repo || !repo.includes("/")) {
    return NextResponse.json({ error: "Use owner/repo format" }, { status: 400 });
  }

  const [owner, name] = repo.split("/");
  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const issuesRes = await fetch(`https://api.github.com/repos/${owner}/${name}/issues?state=open&per_page=30`, { headers, cache: "no-store" });
  const issues = issuesRes.ok ? ((await issuesRes.json()) as Array<{ title: string; body?: string }>) : [];

  const readmeRes = await fetch(`https://raw.githubusercontent.com/${owner}/${name}/HEAD/README.md`, { cache: "no-store" });
  const readme = readmeRes.ok ? await readmeRes.text() : "";

  const mined = readme
    .split("\n")
    .filter((l) => /todo|fixme|hack|optimize|improve/i.test(l))
    .slice(0, 12)
    .map((line) => ({
      title: line.replace(/^[-*#\s]+/, "").slice(0, 80),
      description: `Auto-detected from README: ${line.trim()}`,
      priority: getPriority(line),
      status: "todo",
    }));

  const issueCards = issues
    .filter((i) => !i.title.startsWith("[WIP]"))
    .slice(0, 20)
    .map((i) => ({
      title: i.title,
      description: (i.body || "No issue details").slice(0, 240),
      priority: getPriority(`${i.title} ${i.body || ""}`),
      status: "todo",
    }));

  return NextResponse.json({ cards: [...issueCards, ...mined] });
}
