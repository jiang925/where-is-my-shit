"""Auto-tagging service for conversations.

Extracts tags from conversation content using keyword matching.
Tags include programming languages, frameworks, tools, and topics.
"""

import re

# Programming languages
_LANGUAGES = {
    "python": ["python", "django", "flask", "fastapi", "pip", "pytest", "pydantic"],
    "javascript": ["javascript", "nodejs", "npm", "yarn", "express"],
    "typescript": ["typescript", "tsx", "vitest"],
    "rust": ["rust", "cargo", "tokio"],
    "go": ["golang", " go ", "goroutine"],
    "java": ["java", "spring", "maven", "gradle"],
    "c++": ["c++", "cpp", "cmake"],
    "ruby": ["ruby", "rails", "gem"],
    "swift": ["swift", "swiftui", "xcode"],
    "kotlin": ["kotlin", "android"],
}

# Frameworks and tools
_FRAMEWORKS = {
    "react": ["react", "jsx", "usestate", "useeffect", "nextjs", "next.js"],
    "vue": ["vue", "vuex", "nuxt"],
    "docker": ["docker", "dockerfile", "container", "kubernetes", "k8s"],
    "git": ["git ", "github", "gitlab", "git commit", "git push"],
    "sql": ["sql", "postgres", "mysql", "sqlite", "database"],
    "api": ["api", "rest", "graphql", "endpoint"],
    "css": ["css", "tailwind", "scss", "styling"],
    "testing": ["test", "testing", "unittest", "jest", "pytest", "vitest"],
    "devops": ["ci/cd", "github actions", "pipeline", "deploy"],
    "ai/ml": ["machine learning", "neural", "model", "training", "embedding"],
}

# Topics
_TOPICS = {
    "debugging": ["error", "bug", "fix", "debug", "traceback", "exception"],
    "refactoring": ["refactor", "cleanup", "restructur"],
    "documentation": ["docs", "readme", "documentation", "docstring"],
    "performance": ["performance", "optimization", "slow", "latency", "cache"],
    "security": ["security", "auth", "token", "encryption", "vulnerability"],
    "architecture": ["architecture", "design pattern", "microservice"],
}


def extract_tags(content: str, max_tags: int = 8) -> list[str]:
    """Extract relevant tags from conversation content.

    Uses keyword matching against known programming languages,
    frameworks, tools, and topics.

    Args:
        content: The combined conversation text to analyze.
        max_tags: Maximum number of tags to return.

    Returns:
        A sorted list of tag strings.
    """
    lower = content.lower()
    tags: set[str] = set()

    for tag, keywords in _LANGUAGES.items():
        for kw in keywords:
            if kw in lower:
                tags.add(tag)
                break

    for tag, keywords in _FRAMEWORKS.items():
        for kw in keywords:
            if kw in lower:
                tags.add(tag)
                break

    for tag, keywords in _TOPICS.items():
        for kw in keywords:
            if kw in lower:
                tags.add(tag)
                break

    # Detect code blocks
    if "```" in content:
        tags.add("code")
        # Try to detect language from fenced code blocks
        for lang_match in re.finditer(r"```(\w+)", content):
            lang = lang_match.group(1).lower()
            if lang in ("python", "py"):
                tags.add("python")
            elif lang in ("javascript", "js"):
                tags.add("javascript")
            elif lang in ("typescript", "ts"):
                tags.add("typescript")
            elif lang in ("rust", "go", "java", "ruby", "swift", "kotlin", "sql"):
                tags.add(lang)

    return sorted(tags)[:max_tags]
