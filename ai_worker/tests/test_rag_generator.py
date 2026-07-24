"""Unit tests for the RAG generator module."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag.generator import _build_context, _parse_citations, generate_answer


class TestBuildContext:
    """Tests for _build_context."""

    def test_build_context_formats_correctly(self) -> None:
        """Context should have [N] markers and page numbers."""
        items = [
            {"chunk_text": "First chunk", "chunk_index": 0},
            {"chunk_text": "Second chunk", "chunk_index": 1},
        ]
        result = _build_context(items)
        assert "[1]" in result
        assert "First chunk" in result
        assert "(page 0)" in result
        assert "[2]" in result
        assert "Second chunk" in result
        assert "(page 1)" in result

    def test_build_context_empty(self) -> None:
        """Empty context items should produce empty string."""
        assert _build_context([]) == ""

    def test_build_context_truncates_long_text(self) -> None:
        """Very long context should be truncated."""
        items = [
            {"chunk_text": "A" * 50_000, "chunk_index": 0},
        ]
        result = _build_context(items)
        # MAX_CONTEXT_TOKENS = 3000 → max_chars ≈ 12000
        assert len(result) <= 12_500


class TestParseCitations:
    """Tests for _parse_citations."""

    def test_parse_single_citation(self) -> None:
        """Single [1] citation should return one source."""
        answer = "According to [1], the answer is yes."
        context = [{"chunk_text": "Source content", "chunk_index": 5}]
        sources = _parse_citations(answer, context)
        assert len(sources) == 1
        assert sources[0]["chunkIndex"] == 5
        assert sources[0]["text"] == "Source content"

    def test_parse_multiple_citations(self) -> None:
        """Multiple [1][2] citations should return multiple sources."""
        answer = "Based on [1] and [2], we can conclude."
        context = [
            {"chunk_text": "First source", "chunk_index": 0},
            {"chunk_text": "Second source", "chunk_index": 3},
        ]
        sources = _parse_citations(answer, context)
        assert len(sources) == 2
        assert sources[0]["chunkIndex"] == 0
        assert sources[1]["chunkIndex"] == 3

    def test_parse_no_citations(self) -> None:
        """Answer without citations should return empty sources."""
        answer = "I don't have enough information."
        context = [{"chunk_text": "Some text", "chunk_index": 0}]
        sources = _parse_citations(answer, context)
        assert sources == []

    def test_parse_out_of_range_citation(self) -> None:
        """[5] referencing non-existent chunk should be ignored."""
        answer = "As shown in [5]."
        context = [
            {"chunk_text": "Only one", "chunk_index": 0},
        ]
        sources = _parse_citations(answer, context)
        assert sources == []


class TestGenerateAnswer:
    """Tests for generate_answer."""

    CONTEXT_ITEMS = [
        {"chunk_text": "Python is a programming language.", "chunk_index": 0},
        {"chunk_text": "It was created by Guido van Rossum.", "chunk_index": 1},
    ]

    @patch("app.rag.generator._get_client")
    async def test_generate_answer_success(
        self, mock_get_client: MagicMock,
    ) -> None:
        """generate_answer should return answer with sources on success."""
        mock_client = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = (
            "According to [1], Python is a programming language."
        )
        mock_chunk = MagicMock()
        mock_chunk.choices = [mock_choice]
        mock_client.chat.completions.create = AsyncMock(
            return_value=mock_chunk,
        )
        mock_get_client.return_value = mock_client

        result = await generate_answer(
            "What is Python?", self.CONTEXT_ITEMS
        )

        assert "Python" in result["answer"]
        assert len(result["sources"]) == 1
        assert result["sources"][0]["chunkIndex"] == 0

    async def test_generate_answer_empty_context(self) -> None:
        """Empty context should return 'no information' answer."""
        result = await generate_answer("What is Python?", [])
        assert "don't have enough information" in result["answer"]
        assert result["sources"] == []

    @patch("app.rag.generator._get_client")
    async def test_generate_answer_empty_response(
        self, mock_get_client: MagicMock,
    ) -> None:
        """Empty LLM response should return 'no information' answer."""
        mock_client = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = ""
        mock_chunk = MagicMock()
        mock_chunk.choices = [mock_choice]
        mock_client.chat.completions.create = AsyncMock(
            return_value=mock_chunk,
        )
        mock_get_client.return_value = mock_client

        result = await generate_answer(
            "What is Python?", self.CONTEXT_ITEMS
        )

        assert "don't have enough information" in result["answer"]
        assert result["sources"] == []

    @patch("app.rag.generator._get_client")
    async def test_generate_answer_api_error(
        self, mock_get_client: MagicMock,
    ) -> None:
        """OpenAI API error should propagate."""
        from openai import APIError

        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(
            side_effect=APIError(
                message="API error",
                request=MagicMock(),
                body=None,
            ),
        )
        mock_get_client.return_value = mock_client

        with pytest.raises(APIError):
            await generate_answer("What is Python?", self.CONTEXT_ITEMS)
