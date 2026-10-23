const API_BASE_URL = "http://localhost:8000";

export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/`);
  return res.json();
}

export async function uploadNote(file, page = 1) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("page", page);

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload note image.");
  }
  return res.json();
}

export async function uploadPdf(file, startPage = 1) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("start_page", startPage);

  const res = await fetch(`${API_BASE_URL}/upload-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload and process PDF.");
  }
  return res.json();
}

export async function analyzeNote({ file = null, filename = null, page = 1 }) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (filename) formData.append("filename", filename);
  formData.append("page", page);

  const res = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Analysis failed.");
  }
  return res.json();
}

export async function generateContent(mode, regions) {
  const res = await fetch(`${API_BASE_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, regions }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to generate study materials.");
  }
  return res.json();
}

export async function askAssistant(question, regions) {
  const res = await fetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, regions }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to answer question.");
  }
  return res.json();
}

export function getImageUrl(filename) {
  return `${API_BASE_URL}/uploads/${filename}`;
}
