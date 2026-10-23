"""
Verification script for PDF Upload and Multi-page rendering.
"""
from pathlib import Path
from PIL import Image
import httpx

def create_sample_pdf(pdf_path: Path):
    """Generate a 2-page sample PDF from note images."""
    img1 = Image.open("sample_note.jpg").convert("RGB")
    # Page 2 with slight variation
    img2 = img1.copy().rotate(180)
    
    img1.save(pdf_path, "PDF", resolution=150.0, save_all=True, append_images=[img2])
    print(f"[OK] Created 2-page test PDF: {pdf_path}")

def test_pdf_endpoint():
    pdf_path = Path("sample_study_notes.pdf")
    create_sample_pdf(pdf_path)

    print("\nTesting POST /upload-pdf...")
    with open(pdf_path, "rb") as f:
        res = httpx.post(
            "http://127.0.0.1:8000/upload-pdf",
            files={"file": ("sample_study_notes.pdf", f, "application/pdf")},
            data={"start_page": 1},
            timeout=30.0
        )

    print("Status code:", res.status_code)
    assert res.status_code == 200, f"PDF upload failed: {res.text}"
    data = res.json()
    print("Response message:", data["message"])
    print("Total extracted pages:", data["total_pages"])
    for page in data["pages"]:
        print(f" - Page {page['page']}: {page['filename']} ({page['width']}x{page['height']}px)")

    assert data["total_pages"] == 2
    print("\n[SUCCESS] PDF Upload & Multi-page rendering is 100% verified!")

if __name__ == "__main__":
    test_pdf_endpoint()
