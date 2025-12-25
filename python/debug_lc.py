import sys
print(f"Python: {sys.executable}")
try:
    import langchain
    print(f"LangChain: {langchain.__version__}")
    print(f"LangChain file: {langchain.__file__}")
except ImportError as e:
    print(f"Error importing langchain: {e}")

try:
    from langchain.chains import create_retrieval_chain
    print("Success: from langchain.chains import create_retrieval_chain")
except ImportError as e:
    print(f"Failed: from langchain.chains import create_retrieval_chain -> {e}")

try:
    from langchain.chains.retrieval import create_retrieval_chain
    print("Success: from langchain.chains.retrieval import create_retrieval_chain")
except ImportError as e:
    print(f"Failed: from langchain.chains.retrieval import create_retrieval_chain -> {e}")
