import os
from dotenv import load_dotenv

# LangChain & Google Libraries
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_classic.chains.retrieval import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

# 1. Setup Environment
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in environment. Set it in .env or session.")
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

# 2. Re-Initialize the Embedding Model
embedding_model = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# 3. Load the Existing Vector Database
PERSIST_DIR = os.path.join(os.getcwd(), "database_gemini")
if not os.path.exists(PERSIST_DIR):
    raise FileNotFoundError(f"Could not find database at {PERSIST_DIR}. Please run rag_build.py first.")

vector_store = Chroma(
    collection_name="gemini_rag_collection",
    embedding_function=embedding_model,
    persist_directory=PERSIST_DIR,
)

# 4. Initialize the Gemini LLM
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",  # choose any available model you prefer
    temperature=0.3,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

# 5. Create the RAG Chain
prompt = ChatPromptTemplate.from_template(
    """
You are a helpful AI assistant. Follow the Instructions strictly.

## Instructions:
- Answer the user's question based ONLY on the following context.
- Do not use any external knowledge.
- If the answer is not in the context, respond with "I don't know based on the provided documents."

<context>
{context}
</context>

Question: {input}
"""
)

question_answer_chain = create_stuff_documents_chain(llm, prompt)
retriever = vector_store.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 5},
)
rag_chain = create_retrieval_chain(retriever, question_answer_chain)

# 6. Interactive Chat Loop
print("✅ RAG System Ready! Type 'exit' to quit.\n")
while True:
    user_query = input("You: ")
    if user_query.lower() in ["exit", "quit", "q"]:
        break
    if not user_query.strip():
        continue

    print("Thinking...")
    response = rag_chain.invoke({"input": user_query})

    print(f"\nAI: {response['answer']}")
    print("\n[Sources Used:]")
    if "context" in response:
        for i, doc in enumerate(response["context"]):
            id_val = doc.metadata.get("chunk_id", doc.metadata.get("chunk_index", "Unknown"))
            source = doc.metadata.get("source", "Unknown")
            preview = doc.page_content[:200].replace("\n", " ")
            print(f" - {source} (Chunk ID: {id_val})")
            print(f"   Preview: \"{preview}...\"\n")
    print("-" * 50)
