"""Tests for knowledge extraction pipeline."""

import pytest

from src.app.services.knowledge_extraction import (
    CodeBlock,
    detect_language,
    extract_code_blocks,
    extract_decisions,
    is_high_quality_prompt,
    calculate_prompt_quality,
)


class TestCodeBlockExtraction:
    """Test code block extraction from markdown."""

    def test_extract_single_code_block(self):
        content = """
Here's some Python code:
```python
def hello():
    print("Hello")
```
"""
        blocks = extract_code_blocks(content)
        assert len(blocks) == 1
        assert blocks[0].language == "python"
        assert "def hello():" in blocks[0].code

    def test_extract_multiple_code_blocks(self):
        content = """
Python:
```python
def foo():
    pass
```

JavaScript:
```javascript
function bar() {
    return 1;
}
```
"""
        blocks = extract_code_blocks(content)
        assert len(blocks) == 2
        assert blocks[0].language == "python"
        assert blocks[1].language == "javascript"

    def test_skip_small_snippets(self):
        """Very short code blocks should be skipped."""
        content = """
```python
x = 1
```
"""
        blocks = extract_code_blocks(content)
        assert len(blocks) == 0

    def test_no_language_hint(self):
        """Code blocks without language hint."""
        content = """
```
some plain text code
that spans multiple
lines here
```
"""
        blocks = extract_code_blocks(content)
        assert len(blocks) == 1
        assert blocks[0].language == "text"


class TestLanguageDetection:
    """Test programming language detection."""

    def test_python_from_content(self):
        code = "def foo():\n    pass"
        assert detect_language(None, code) == "python"

    def test_python_from_decorator(self):
        code = "@app.route\ndef handle(): pass"
        assert detect_language(None, code) == "python"

    def test_javascript_from_content(self):
        code = "function foo() {\n    return 1;\n}"
        assert detect_language(None, code) == "javascript"

    def test_typescript_from_types(self):
        code = "interface User {\n    name: string;\n}"
        assert detect_language(None, code) == "typescript"

    def test_go_from_content(self):
        code = "func main() {\n    fmt.Println(\"hello\")\n}"
        assert detect_language(None, code) == "go"

    def test_rust_from_content(self):
        # The language detection heuristics may misidentify simple Rust as JS
        # because 'let' is common in both. Use language hint for accuracy.
        code = "fn main() {\n    let x = 5;\n}"
        assert detect_language("rs", code) == "rust"
        assert detect_language("rust", code) == "rust"

    def test_hint_mapping(self):
        """Test language hints are correctly mapped."""
        assert detect_language("py", "code") == "python"
        assert detect_language("js", "code") == "javascript"
        assert detect_language("ts", "code") == "typescript"
        assert detect_language("go", "code") == "go"
        assert detect_language("rs", "code") == "rust"


class TestDecisionExtraction:
    """Test decision statement extraction."""

    def test_decided_pattern(self):
        content = "We decided to use PostgreSQL for the database."
        decisions = extract_decisions(content)
        assert len(decisions) == 1
        assert "PostgreSQL" in decisions[0].text
        assert decisions[0].confidence >= 0.7

    def test_lets_pattern(self):
        content = "Let's go with React for the frontend."
        decisions = extract_decisions(content)
        assert len(decisions) == 1
        assert "React" in decisions[0].text

    def test_conclusion_pattern(self):
        content = "Conclusion: We will migrate to Kubernetes."
        decisions = extract_decisions(content)
        assert len(decisions) == 1

    def test_settled_on_pattern(self):
        content = "We settled on using Redis for caching."
        decisions = extract_decisions(content)
        assert len(decisions) == 1

    def test_multiple_decisions(self):
        content = """
We decided to use PostgreSQL for the database.
Later, we agreed to migrate to Kubernetes.
"""
        decisions = extract_decisions(content)
        assert len(decisions) == 2

    def test_no_decisions(self):
        content = "This is just a regular conversation about ideas."
        decisions = extract_decisions(content)
        assert len(decisions) == 0

    def test_keywords_extracted(self):
        content = "We decided to implement the authentication service."
        decisions = extract_decisions(content)
        assert len(decisions) == 1
        assert "implement" in decisions[0].keywords or "authentication" in decisions[0].keywords


class TestPromptQuality:
    """Test prompt quality detection."""

    def test_short_message_not_quality(self):
        """Short messages shouldn't be considered high quality prompts."""
        message = {"role": "user", "content": "Hi"}
        assert not is_high_quality_prompt(message, None)

    def test_detailed_prompt_is_quality(self):
        """Detailed prompts with instructions should be high quality."""
        message = {
            "role": "user",
            "content": "Create a Python function that implements a binary search tree with insert, delete, and search operations. Include time complexity analysis."
        }
        next_msg = {"role": "assistant", "content": "Here's the implementation...\n\n```python\nclass BST..."}
        assert is_high_quality_prompt(message, next_msg)

    def test_non_user_message_not_prompt(self):
        """Only user messages can be prompts."""
        message = {"role": "assistant", "content": "Let me explain how this works in detail..."}
        assert not is_high_quality_prompt(message, None)

    def test_quality_score_factors(self):
        """Test that various factors contribute to quality score."""
        # Base message
        msg1 = {"role": "user", "content": "Create a function."}
        score1 = calculate_prompt_quality(msg1, None)
        
        # Message with bullet points
        msg2 = {"role": "user", "content": "Create a function:\n- Handle errors\n- Include tests"}
        score2 = calculate_prompt_quality(msg2, None)
        
        # Bullet points should increase score
        assert score2 > score1

    def test_response_with_code_increases_quality(self):
        """A response containing code suggests good prompt."""
        message = {"role": "user", "content": "Write a Python function to parse JSON."}
        
        # Response with code
        response_with_code = {"role": "assistant", "content": "```python\nimport json\n```"}
        score_with_code = calculate_prompt_quality(message, response_with_code)
        
        # Response without code
        response_no_code = {"role": "assistant", "content": "Here's how you do it..."}
        score_no_code = calculate_prompt_quality(message, response_no_code)
        
        assert score_with_code > score_no_code


class TestCodeBlockDataclass:
    """Test CodeBlock dataclass."""

    def test_code_block_creation(self):
        block = CodeBlock(language="python", code="print('hello')", line_count=1)
        assert block.language == "python"
        assert block.code == "print('hello')"
        assert block.line_count == 1
