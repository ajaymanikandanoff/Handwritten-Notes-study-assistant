from enum import Enum
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field, model_validator


class RegionType(str, Enum):
    SENTENCE = "sentence"
    EQUATION = "equation"
    MARKED_IMPORTANT = "marked-important"
    FLOWCHART = "flowchart"
    DIAGRAM = "diagram"


class BoundingBox(BaseModel):
    x: int = Field(..., ge=0, le=1000, description="Top-left x coordinate on a 0-1000 scale")
    y: int = Field(..., ge=0, le=1000, description="Top-left y coordinate on a 0-1000 scale")
    width: int = Field(..., ge=0, le=1000, description="Region width on a 0-1000 scale")
    height: int = Field(..., ge=0, le=1000, description="Region height on a 0-1000 scale")


class Region(BaseModel):
    chunk_id: str = Field(..., description="Unique identifier for the region chunk (e.g., page-1-region-1)")
    page: int = Field(default=1, description="1-indexed page number of the note")
    type: RegionType = Field(..., description="Classified region category")
    text: str = Field(..., description="Transcribed text or description of the region")
    box: Union[BoundingBox, List[int], Dict[str, Any]] = Field(..., description="Bounding box {x, y, width, height} on a 0-1000 scale")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")


class RawVisionRegion(BaseModel):
    """Schema returned by Vision LLMs before chunk_id and coordinate normalization are applied."""
    type: RegionType
    text: str
    box: Union[BoundingBox, List[int], Dict[str, Any]] = Field(..., description="Bounding box")
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)


class PageAnalysis(BaseModel):
    page: int = Field(..., description="1-indexed page number")
    imageId: str = Field(..., description="Identifier or saved filename of the uploaded image")
    image_url: Optional[str] = Field(default=None, description="URL path to access the image for highlighting")
    width: Optional[int] = Field(default=None, description="Original image width in pixels")
    height: Optional[int] = Field(default=None, description="Original image height in pixels")
    regions: List[Region] = Field(default_factory=list, description="Extracted regions for this page")


class AnalyzeResponse(BaseModel):
    success: bool = Field(default=True, description="Indicates whether analysis completed successfully")
    pages: List[PageAnalysis] = Field(default_factory=list, description="Array of analyzed page results")
    regions: Optional[List[Region]] = Field(default_factory=list, description="All regions aggregated across pages")
    total_regions: Optional[int] = Field(default=0, description="Total count of regions across pages")
    provider: Optional[str] = Field(default="gemini", description="Provider used ('gemini', 'openai', or 'ocr-fallback')")


class OcrChunk(BaseModel):
    chunk_id: str
    text: str
    box: List[int] = Field(..., description="[left, top, right, bottom]")
    confidence: float


class OcrResponse(BaseModel):
    chunks: List[OcrChunk]
    total_chunks: int


class UploadResponse(BaseModel):
    filename: str
    file_path: str
    page: int
    width: int
    height: int
    message: str


class PdfUploadResponse(BaseModel):
    pdf_filename: str
    total_pages: int
    pages: List[UploadResponse]
    message: str


class SourceReference(BaseModel):
    chunk_id: str = Field(..., description="Referenced source region chunk ID")
    page: int = Field(default=1, description="1-indexed source page number")
    box: Optional[Union[BoundingBox, List[int], Dict[str, Any]]] = Field(default=None, description="Bounding box on a 0-1000 scale")


class QuizQuestionType(str, Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"


class QuizQuestion(BaseModel):
    id: str = Field(..., description="Unique question ID")
    type: QuizQuestionType = Field(default=QuizQuestionType.MCQ)
    question: str = Field(..., description="Grounded question strictly from the notes")
    options: Optional[List[str]] = Field(default=None, description="Options for multiple choice (4 choices for MCQ)")
    correct_answer: str = Field(..., description="Correct answer text or option")
    explanation: str = Field(..., description="Why this is the answer according to the notes")
    source_chunk_id: str = Field(..., description="Primary source region chunk ID")
    source_page: int = Field(default=1, description="Primary source page number")
    source_box: Optional[Union[BoundingBox, List[int], Dict[str, Any]]] = Field(default=None, description="Primary source bounding box")
    sources: List[SourceReference] = Field(default_factory=list, description="All source regions referenced (supports composite questions)")

    @model_validator(mode="after")
    def sync_sources(self) -> "QuizQuestion":
        if not self.sources and self.source_chunk_id:
            self.sources = [
                SourceReference(
                    chunk_id=self.source_chunk_id,
                    page=self.source_page,
                    box=self.source_box
                )
            ]
        elif self.sources:
            if not self.source_chunk_id:
                self.source_chunk_id = self.sources[0].chunk_id
                self.source_page = self.sources[0].page
                self.source_box = self.sources[0].box
        return self


class StudySection(BaseModel):
    title: str
    content: str
    source_chunk_ids: List[str] = Field(default_factory=list)
    importance: str = Field(default="normal")


class EquationBreakdown(BaseModel):
    equation: str
    source_chunk_id: str
    source_page: int
    source_box: Optional[Union[BoundingBox, List[int], Dict[str, Any]]] = None
    step_by_step: List[str]
    meaning: str


class DiagramExplanation(BaseModel):
    title: str
    source_chunk_id: str
    source_page: int
    source_box: Optional[Union[BoundingBox, List[int], Dict[str, Any]]] = None
    verbal_description: str
    key_components: List[str]


class StudyAid(BaseModel):
    summary: str
    sections: List[StudySection] = Field(default_factory=list)
    equation_breakdowns: List[EquationBreakdown] = Field(default_factory=list)
    diagram_explanations: List[DiagramExplanation] = Field(default_factory=list)


class GenerateRequest(BaseModel):
    mode: str = Field(default="both", description="'learn', 'test', or 'both'")
    regions: List[Region] = Field(default_factory=list, description="List of all extracted regions")


class GenerateResponse(BaseModel):
    mode: str
    study_aid: Optional[StudyAid] = None
    quiz: Optional[List[QuizQuestion]] = None
    total_questions: int = 0


class AskRequest(BaseModel):
    question: str = Field(..., description="Student voice or text question")
    regions: List[Region] = Field(..., description="Available note regions")


class AskResponse(BaseModel):
    answer: str
    source_chunk_ids: List[str] = Field(default_factory=list)
    source_page: Optional[int] = None
    source_box: Optional[Union[BoundingBox, List[int], Dict[str, Any]]] = None


class PdfPageData(BaseModel):
    page: int
    filename: str
    width: int
    height: int
    regions: List[Region] = Field(default_factory=list)


class AnalyzePdfResponse(BaseModel):
    pdf_filename: str
    total_pages: int
    study_aid: Optional[StudyAid] = None
    quiz: Optional[List[QuizQuestion]] = None
    pages: List[PdfPageData] = Field(default_factory=list)
    execution_time_seconds: float = 0.0
    message: str = ""


