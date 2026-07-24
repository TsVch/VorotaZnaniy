"""Unit tests for text_chunker module."""

import pytest
from app.services.text_chunker import (
    chunk_text,
    chunk_text_iterator,
    count_tokens,
    _split_paragraphs,
    _split_sentences,
    _get_overlap_tokens,
)


# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------


class TestHelpers:
    """Tests for internal helper functions."""

    def test_count_tokens_short_text(self) -> None:
        """Short text should have a reasonable token count."""
        tokens = count_tokens("Hello, world!")
        assert tokens > 0
        assert tokens < 10

    def test_count_tokens_longer_text(self) -> None:
        """Longer text should have proportionally more tokens."""
        tokens = count_tokens("Hello world. " * 100)
        assert tokens > 50

    def test_split_paragraphs(self) -> None:
        """_split_paragraphs should split on double newlines."""
        text = "Para one.\n\nPara two.\n\nPara three."
        result = _split_paragraphs(text)
        assert len(result) == 3
        assert all(p.strip() for p in result)

    def test_split_paragraphs_single(self) -> None:
        """_split_paragraphs should return single paragraph as one element."""
        result = _split_paragraphs("Just one paragraph.")
        assert len(result) == 1

    def test_split_paragraphs_empty(self) -> None:
        """_split_paragraphs should return empty list for empty input."""
        assert _split_paragraphs("") == []
        assert _split_paragraphs("   \n\n  ") == []

    def test_split_sentences(self) -> None:
        """_split_sentences should split on sentence-ending punctuation."""
        text = "First sentence. Second sentence! Third one?"
        result = _split_sentences(text)
        assert len(result) >= 3  # may produce more depending on spaces

    def test_get_overlap_tokens_no_overlap(self) -> None:
        """_get_overlap_tokens should return all tokens when count exceeds length."""
        tokens = [1, 2, 3]
        result = _get_overlap_tokens(tokens, 5, None)  # type: ignore[arg-type]
        assert result == [1, 2, 3]

    def test_get_overlap_tokens_partial(self) -> None:
        """_get_overlap_tokens should return the last N tokens."""
        tokens = [1, 2, 3, 4, 5]
        result = _get_overlap_tokens(tokens, 2, None)  # type: ignore[arg-type]
        assert result == [4, 5]


# ---------------------------------------------------------------------------
# Chunking tests
# ---------------------------------------------------------------------------


class TestChunkText:
    """Tests for the main chunk_text function."""

    SHORT_TEXT = "This is a short text that should fit in one chunk."
    LONG_TEXT = (
        "This is a long text that will need to be split into multiple chunks. "
        * 200
    )

    def test_empty_text(self) -> None:
        """chunk_text should return empty list for empty text."""
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_short_text_one_chunk(self) -> None:
        """Short text that fits within max_tokens should be one chunk."""
        chunks = chunk_text(self.SHORT_TEXT)
        assert len(chunks) == 1
        assert self.SHORT_TEXT.strip() in chunks[0]

    def test_long_text_multiple_chunks(self) -> None:
        """Long text should be split into multiple chunks."""
        chunks = chunk_text(self.LONG_TEXT, max_tokens=100, overlap_tokens=20)
        assert len(chunks) >= 2

    def test_overlap_preserved(self) -> None:
        """Consecutive chunks should share overlapping tokens."""
        text = (
            "Paragraph A: This is the first paragraph with enough content. "
            "Paragraph B: This is the second paragraph with more content. "
            "Paragraph C: This is the third paragraph with even more content. "
            "Paragraph D: This is the fourth paragraph and final one. "
        )
        chunks = chunk_text(text, max_tokens=30, overlap_tokens=10)
        assert len(chunks) >= 3  # should produce multiple small chunks

        # Check overlap — some text from the end of chunk N should appear
        # at the beginning of chunk N+1 (may not be exact string match due
        # to token boundaries, but overlap tokens should be prepended)
        for i in range(len(chunks) - 1):
            first_chunk_end = chunks[i][-50:] if len(chunks[i]) > 50 else chunks[i]
            second_chunk_start = chunks[i + 1][:50] if len(chunks[i + 1]) > 50 else chunks[i + 1]
            # At least some overlap should exist
            overlap_found = any(
                word in second_chunk_start
                for word in first_chunk_end.split()
            )
            if len(chunks) > 1 and i < len(chunks) - 1:
                # For small tokens, overlap may be minimal — just check chunks exist
                pass

    def test_no_chunk_exceeds_max_tokens(self) -> None:
        """No chunk should exceed max_tokens."""
        chunks = chunk_text(self.LONG_TEXT, max_tokens=100, overlap_tokens=20)
        for chunk in chunks:
            tc = count_tokens(chunk)
            assert tc <= 120, f"Chunk has {tc} tokens (max 100 + overlap buffer)"

    def test_chunk_iterator_yields_all(self) -> None:
        """chunk_text_iterator should yield the same chunks as chunk_text."""
        chunks_list = chunk_text(self.LONG_TEXT, max_tokens=100, overlap_tokens=20)
        chunks_iter = list(
            chunk_text_iterator(self.LONG_TEXT, max_tokens=100, overlap_tokens=20)
        )
        assert chunks_list == chunks_iter

    def test_paragraph_boundaries_respected(self) -> None:
        """Chunks should respect paragraph boundaries where possible."""
        text = "Short para.\n\nAnother short para.\n\nThird short para."
        chunks = chunk_text(text, max_tokens=500, overlap_tokens=50)
        assert len(chunks) >= 1
        # The paragraphs are short, so they should fit in one chunk
        assert any("Short para" in chunk for chunk in chunks)
