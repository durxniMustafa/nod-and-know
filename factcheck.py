import pymupdf
from sentence_transformers import SentenceTransformer
import chromadb
from pathlib import Path
import numpy as np
import re
from typing import List, Dict
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimplePDFFactChecker:
    def __init__(self, pdf_directory="Papers/", chunk_size=300, overlap=50):
        self.pdf_directory = Path(pdf_directory)
        self.chunk_size = chunk_size
        self.overlap = overlap
        
        # Initialize embedding model only
        logger.info("Loading embedding model...")
        self.embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        
        # Initialize ChromaDB
        self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        
        # Try to get existing collection or create new one
        try:
            self.collection = self.chroma_client.get_collection(name="factcheck_collection")
            logger.info("Loaded existing collection")
        except:
            self.collection = self.chroma_client.create_collection(name="factcheck_collection")
            logger.info("Created new collection")
            self._process_pdfs()
    
    def clean_text(self, text: str) -> str:
        """Clean extracted text from PDFs"""
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'[^\w\s.,;:!?()-]', '', text)
        text = re.sub(r'\b\w{1,2}\b', '', text)
        return text.strip()
    
    def chunk_text_with_overlap(self, text: str) -> List[str]:
        """Create overlapping chunks to preserve context"""
        chunks = []
        start = 0
        text_len = len(text)
        
        while start < text_len:
            end = min(start + self.chunk_size, text_len)
            chunk = text[start:end]
            
            if end < text_len and not text[end].isspace():
                last_space = chunk.rfind(' ')
                if last_space > start + self.chunk_size // 2:
                    end = start + last_space
                    chunk = text[start:end]
            
            chunks.append(chunk.strip())
            start = end - self.overlap
            
            if start >= text_len:
                break
                
        return [chunk for chunk in chunks if len(chunk) > 50]
    
    def _process_pdfs(self):
        """Process all PDFs and store in vector database"""
        pdf_files = list(self.pdf_directory.glob("*.pdf"))
        
        if not pdf_files:
            logger.warning(f"No PDF files found in {self.pdf_directory}")
            return
        
        logger.info(f"Processing {len(pdf_files)} PDF files...")
        
        all_chunks = []
        all_metadata = []
        
        for pdf_path in pdf_files:
            logger.info(f"Processing {pdf_path.name}")
            
            try:
                with pymupdf.open(pdf_path) as doc:
                    text = ""
                    for page_num, page in enumerate(doc):
                        page_text = page.get_text()
                        if page_text.strip():
                            text += f" {page_text}"
                    
                    cleaned_text = self.clean_text(text)
                    chunks = self.chunk_text_with_overlap(cleaned_text)
                    
                    metadata = doc.metadata or {}
                    for i, chunk in enumerate(chunks):
                        all_chunks.append(chunk)
                        all_metadata.append({
                            'source': pdf_path.name,
                            'chunk_id': i,
                            'title': metadata.get('title', pdf_path.stem),
                            'author': metadata.get('author', 'Unknown')
                        })
                        
            except Exception as e:
                logger.error(f"Error processing {pdf_path}: {e}")
                continue
        
        if all_chunks:
            logger.info("Generating embeddings...")
            embeddings = self.embedding_model.encode(
                all_chunks,
                batch_size=16,
                show_progress_bar=True,
                convert_to_numpy=True
            )
            
            logger.info("Storing in vector database...")
            self.collection.add(
                documents=all_chunks,
                embeddings=embeddings.tolist(),
                metadatas=all_metadata,
                ids=[f"chunk_{i}" for i in range(len(all_chunks))]
            )
            logger.info(f"Stored {len(all_chunks)} chunks in database")
    
    def retrieve_relevant_context(self, query: str, top_k: int = 5) -> List[Dict]:
        """Retrieve most relevant chunks for a given query"""
        query_embedding = self.embedding_model.encode([query])
        
        results = self.collection.query(
            query_embeddings=query_embedding.tolist(),
            n_results=top_k
        )
        
        relevant_chunks = []
        for i in range(len(results['documents'][0])):
            relevant_chunks.append({
                'text': results['documents'][0][i],
                'metadata': results['metadatas'][0][i],
                'distance': results['distances'][0][i]
            })
        
        return relevant_chunks
    
    def simple_fact_check(self, message: str, similarity_threshold: float = 0.3) -> Dict:
        """Simple fact-checking based on similarity only"""
        logger.info(f"Fact-checking message: {message[:100]}...")
        
        # Extract claims/statements from the message
        sentences = re.split(r'[.!?]+', message)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
        
        results = {
            'is_supported': True,
            'confidence': 1.0,
            'claim_results': [],
            'sources': []
        }
        
        for sentence in sentences:
            if len(sentence) < 20:
                continue
            
            # Retrieve relevant context
            relevant_chunks = self.retrieve_relevant_context(sentence, top_k=3)
            
            if relevant_chunks and relevant_chunks[0]['distance'] < similarity_threshold:
                # Found supporting evidence
                best_match = relevant_chunks[0]
                confidence = 1 - best_match['distance']  # Convert distance to confidence
                
                results['claim_results'].append({
                    'claim': sentence,
                    'confidence': confidence,
                    'supporting_text': best_match['text'][:200] + "...",
                    'source': best_match['metadata']
                })
                
                # Add source information
                source_info = {
                    'title': best_match['metadata']['title'],
                    'source': best_match['metadata']['source']
                }
                if source_info not in results['sources']:
                    results['sources'].append(source_info)
            else:
                # No supporting evidence found
                results['is_supported'] = False
                results['confidence'] = min(results['confidence'], 0.3)
                
                results['claim_results'].append({
                    'claim': sentence,
                    'confidence': 0.0,
                    'supporting_text': "Keine unterstützenden Belege gefunden",
                    'source': None
                })
        
        return results
    
    def format_simple_response(self, results: Dict) -> str:
        """Format the simple fact-check results"""
        if results['is_supported']:
            response = "✅ **Nachricht wird durch Ihre Dokumente unterstützt**\n\n"
        else:
            response = "⚠️ **Nachricht hat keine Unterstützung in Ihren Dokumenten**\n\n"
        
        for claim_result in results['claim_results']:
            claim = claim_result['claim']
            confidence = claim_result['confidence']
            supporting_text = claim_result['supporting_text']
            
            if confidence > 0.7:
                response += f"✅ **Stark unterstützt** (Konfidenz: {confidence:.2%})\n"
            elif confidence > 0.3:
                response += f"🟡 **Teilweise unterstützt** (Konfidenz: {confidence:.2%})\n"
            else:
                response += f"❌ **Nicht unterstützt** (Konfidenz: {confidence:.2%})\n"
            
            response += f"Behauptung: \"{claim}\"\n"
            response += f"Unterstützung: {supporting_text}\n\n"
        
        if results['sources']:
            response += "**Quellen:**\n"
            for source in results['sources']:
                response += f"- {source['title']} ({source['source']})\n"
        
        return response

# Example usage
if __name__ == "__main__":
    # Initialize the simple fact checker
    factchecker = SimplePDFFactChecker()
    
    # Example messages to check
    test_messages = [
        "Password Managers sind nutzlos."
    ]
    
    for message in test_messages:
        print(f"\n{'='*50}")
        print(f"Testing: {message}")
        print('='*50)
        
        results = factchecker.simple_fact_check(message)
        formatted_response = factchecker.format_simple_response(results)
        print(formatted_response)