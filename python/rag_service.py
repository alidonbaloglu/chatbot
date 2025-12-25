import os
import shutil
from typing import List, Optional
from uuid import uuid4
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, PrivateAttr

# LangChain & Gemini
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_classic.chains.retrieval import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain

# Semantic Chunking
from semantic_router.encoders import DenseEncoder
from semantic_chunkers import StatisticalChunker
from langchain_community.document_loaders import PyPDFLoader, TextLoader, UnstructuredFileLoader

# Load Environment
load_dotenv()

# We need GOOGLE_API_KEY (or GEMINI_API_KEY)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if not GOOGLE_API_KEY:
    print("Warning: GOOGLE_API_KEY not found. Please set it in .env")
else:
    os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

app = FastAPI(title="ChatBot RAG Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration ---
PERSIST_DIR = os.path.join(os.getcwd(), "database_gemini")
UPLOADS_DIR = os.path.join(os.getcwd(), "temp_rag_uploads")

if not os.path.exists(UPLOADS_DIR):
    os.makedirs(UPLOADS_DIR)

# --- Models ---

class ChatRequest(BaseModel):
    message: str
    history: List[dict] = [] # List of {role: "", content: ""}
    model: str = "gemini-1.5-flash"

class IngestRequest(BaseModel):
    filename: str
    file_path: str # Path to the file already on disk (shared volume)

# --- RAG Components Initialization ---

# 1. Embeddings
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# 2. Vector DB (Chroma)
vector_store = Chroma(
    collection_name="gemini_rag_collection",
    embedding_function=embeddings,
    persist_directory=PERSIST_DIR,
)

# 3. Custom Encoder for Semantic Chunking
class LangChainEncoderWrapper(DenseEncoder):
    _lc_embed: object = PrivateAttr()

    def __init__(self, langchain_embeddings, name: str = "gemini-embedding-004", score_threshold: float = 0.3):
        super().__init__(name=name, score_threshold=score_threshold)
        self._lc_embed = langchain_embeddings

    def __call__(self, docs: list[str]) -> list[list[float]]:
        return self._lc_embed.embed_documents(docs)

    async def acall(self, docs: list[str]) -> list[list[float]]:
        return await self._lc_embed.aembed_documents(docs)

custom_encoder = LangChainEncoderWrapper(embeddings)

# --- Routes ---

@app.get("/")
def read_root():
    return {"status": "ok", "service": "RAG Backend"}

@app.post("/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        # 1. Setup Retrieval Chain
        llm = ChatGoogleGenerativeAI(
            model=req.model,
            temperature=0.3,
            max_retries=2,
        )

        prompt_template = ChatPromptTemplate.from_template(
            """
            You are a helpful AI assistant. Answer the user's question based strictly on the provided context.
            If the answer is not in the context, say "I don't have enough information in the provided documents."

            <context>
            {context}
            </context>

            Question: {input}
            """
        )

        # Basic history handling: Convert last few messages to context if needed?
        # For simplicity, we just use the current message for retrieval, but we could augment it.
        # Actually RAG chains primarily use the 'input' for retrieval. History can be passed if using create_history_aware_retriever.
        # For this version, let's keep it simple: Standard RAG on the last question.

        question_answer_chain = create_stuff_documents_chain(llm, prompt_template)
        retriever = vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 5},
        )
        rag_chain = create_retrieval_chain(retriever, question_answer_chain)

        # 2. Invoke
        response = await rag_chain.ainvoke({"input": req.message})
        
        # 3. Format Response
        answer = response["answer"]
        sources = []
        if "context" in response:
            seen_sources = set()
            for doc in response["context"]:
                src = doc.metadata.get("source", "Unknown")
                if src not in seen_sources:
                    sources.append(src)
                    seen_sources.add(src)
        
        return {
            "content": answer,
            "sources": sources
        }

    except Exception as e:
        print(f"Error in /chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest")
async def ingest_endpoint(file: UploadFile = File(...)):
    """
    Receives a file upload, saves it, chunks it, and adds to Vector DB.
    """
    try:
        # 1. Save File Temporarily
        temp_path = os.path.join(UPLOADS_DIR, file.filename)
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"Processing file: {temp_path}")

        # 2. Load File Content
        docs = []
        if file.filename.lower().endswith(".pdf"):
            loader = PyPDFLoader(temp_path)
            docs = loader.load()
        else:
            # Fallback for text based
            loader = TextLoader(temp_path, encoding="utf-8") # simplified
            docs = loader.load()
        
        if not docs:
            return {"status": "error", "message": "No text content found"}

        full_text = "\n\n".join([d.page_content for d in docs])
        
        # 3. Chunking
        print("Chunking...")
        chunker = StatisticalChunker(encoder=custom_encoder)
        chunks = chunker(docs=[full_text])

        processed_documents = []
        if chunks and len(chunks) > 0:
            for i, chunk in enumerate(chunks[0]):
                content = " ".join(chunk.splits)
                new_doc = Document(
                    page_content=content,
                    metadata={
                        "source": file.filename,
                        "chunk_index": i,
                        "chunk_id": str(uuid4()),
                    },
                )
                processed_documents.append(new_doc)
        
        # 4. Add to Chroma
        if processed_documents:
            print(f"Adding {len(processed_documents)} chunks to DB...")
            vector_store.add_documents(processed_documents)
        
        # Cleanup
        os.remove(temp_path)

        return {
            "status": "success", 
            "filename": file.filename, 
            "chunks_added": len(processed_documents)
        }

    except Exception as e:
        print(f"Error in /ingest: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reset")
def reset_db():
    try:
        if os.path.exists(PERSIST_DIR):
            # Chroma keeps files locked sometimes, this might fail on Windows if active
            # For now, just try to reset the collection object logic if possible, or warn user.
            vector_store.delete_collection()
            return {"status": "success", "message": "Collection cleared"}
        return {"status": "ignored", "message": "DB does not exist"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
