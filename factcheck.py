import pymupdf
from sentence_transformers import SentenceTransformer
import chromadb
from pathlib import Path

# returns all file paths that has .pdf as extension in the specified directory
pdf_search = Path("Papers/").glob("*.pdf")

#Converts each found PDF file's path to its absolute path as a string.
#file.absolute() returns the full path to each PDF file
pdf_files = pdf_files = [str(file.absolute()) for file in pdf_search]

#create chunks from text
def chunk_text(text, chunk_size=300):
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

text = ""

for pdf in pdf_files:
    with pymupdf.open(pdf) as doc:
        for page in doc: # iterate the document pages
            text += page.get_text() # get plain text encoded as UTF-8
            
            meta = doc.metadata # save metadata
            chunks = chunk_text(text) # safe chunks

            

#2. Step using all-MiniLM-L6-v2: covert text to vectors
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
#loop to go though chunks
embeddings = model.encode(
    chunks,
    batch_size=16,
    show_progress_bar=True
)

print(embeddings)

#3. collect vetors in Vector Databse

chroma_client = chromadb.Client()

#Create a collection
collection = chroma_client.create_collection(name="my_collection")
collection.add(
    documents=chunks, # readable text
    embeddings=embeddings.tolist(), #vector data
    ids=[f"chunk_{i}" for i in range(len(chunks))] #unique keys
)