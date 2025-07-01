import pymupdf
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




