# Python RAG (Gemini + Chroma)

This optional Python setup builds a vector database from your PDFs and runs a retrieval-augmented chat using Gemini.

## Setup (Windows PowerShell)

```powershell
# Create and activate venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install packages
pip install -r python/requirements.txt

# Configure environment (set your Google AI Studio key)
$env:GOOGLE_API_KEY = "YOUR_GOOGLE_API_STUDIO_KEY"
```

## Build the Vector DB
Place PDFs under `documents/`, then run:

```powershell
python python/rag_build.py
```

This creates `database_gemini/` with a `gemini_rag_collection`.

## Run RAG Chat
```powershell
python python/rag_chat.py
```

Ask questions; answers are grounded only in your documents, with sources preview.

## Notes
- Uses `models/text-embedding-004` for embeddings and Gemini chat for answers.
- Keep your API key out of the repo; use env vars or `.env` in local only.
- You can change the chat model (e.g., `gemini-1.5-pro`, `gemini-2.5-flash-lite`) if available to your account.
