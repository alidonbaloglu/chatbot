import os
import time
from uuid import uuid4
from dotenv import load_dotenv

# libraries for chunking & routing
from semantic_router.encoders import DenseEncoder
from semantic_chunkers import StatisticalChunker
from pydantic import PrivateAttr

# libraries for langchain & database
from langchain_community.document_loaders import PyPDFDirectoryLoader
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

# 1. Setup Environment
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment. Set it in .env or session.")
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY
print("✅ Environment configured.")

# 2. Initialize Gemini Embeddings (LangChain)
# This is the "Engine" that will do the actual embedding work for both chunking and storage.
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# 3. Custom Encoder Wrapper (Fix: proper method names for pydantic/encoder base)
class LangChainEncoderWrapper(DenseEncoder):
    _lc_embed: object = PrivateAttr()

    def __init__(self, langchain_embeddings, name: str = "gemini-embedding-004", score_threshold: float = 0.3):
        super().__init__(name=name, score_threshold=score_threshold)
        self._lc_embed = langchain_embeddings

    def __call__(self, docs: list[str]) -> list[list[float]]:
        return self._lc_embed.embed_documents(docs)

    async def acall(self, docs: list[str]) -> list[list[float]]:
        return await self._lc_embed.aembed_documents(docs)

# Wrap our working Gemini embeddings
custom_encoder = LangChainEncoderWrapper(embeddings)
print("✅ Encoder wrapper initialized.")

# 4. Load Documents
DOCS_PATH = os.path.join(os.getcwd(), "documents")
if not os.path.exists(DOCS_PATH):
    os.makedirs(DOCS_PATH)
    print(f"⚠️ Created folder {DOCS_PATH}. Please add your PDF files there and run again.")
    raise SystemExit(0)

print(f"📂 Loading PDFs from {DOCS_PATH}...")
loader = PyPDFDirectoryLoader(DOCS_PATH)
raw_docs = loader.load()

if not raw_docs:
    raise ValueError("❌ No documents found or PDFs are empty.")

# Combine all text for global semantic analysis
whole_text = "\n\n".join([page.page_content for page in raw_docs])
print(f"   - Loaded {len(raw_docs)} pages.")
print(f"   - Total characters: {len(whole_text)}")

# 5. Semantic Chunking
print("🔨 Starting Statistical Chunking (this may take a moment)...")
chunker = StatisticalChunker(encoder=custom_encoder)
chunks = chunker(docs=[whole_text])

# 6. Process Chunks into LangChain Documents
processed_documents = []
if chunks and len(chunks) > 0:
    for i, chunk in enumerate(chunks[0]):
        content = " ".join(chunk.splits)
        new_doc = Document(
            page_content=content,
            metadata={
                "source": "semantic_doc",
                "chunk_index": i,
                "token_count": len(content.split()),
                "chunk_id": str(uuid4()),
            },
        )
        processed_documents.append(new_doc)
    print(f"✅ Generated {len(processed_documents)} semantic chunks.")
else:
    raise ValueError("⚠️ Chunker returned no results. Input text might be too short or abstract.")

# 7. Create/Update Vector Database (Chroma)
print("💾 Saving to ChromaDB...")
persist_dir = os.path.join(os.getcwd(), "database_gemini")
vector_store = Chroma(
    collection_name="gemini_rag_collection",
    embedding_function=embeddings,  # RAW LangChain object here
    persist_directory=persist_dir,
)

batch_size = 50
total_chunks = len(processed_documents)
print(f"   - Adding {total_chunks} documents to the database...")
for i in range(0, total_chunks, batch_size):
    batch = processed_documents[i : i + batch_size]
    vector_store.add_documents(documents=batch)
    print(f"   - Added batch {i}-{min(i+batch_size, total_chunks)}")
    time.sleep(0.5)
print(f"🎉 Database successfully created at {persist_dir}")
