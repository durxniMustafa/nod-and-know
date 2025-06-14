import pymupdf
from sentence_transformers import SentenceTransformer
import chromadb


#1.Step using PyMuPDF: Parse PDF File
 # imports the pymupdf library
doc = pymupdf.open("Papers/PSUI_Interaction.pdf") # open a document
text = ""
for page in doc: # iterate the document pages
    text += page.get_text() # get plain text encoded as UTF-8

#1.5 Chunk text
def chunk_text(text, chunk_size=300):
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

chunks = chunk_text(text)

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