import pymupdf
from sentence_transformers import SentenceTransformer
import chromadb
from pathlib import Path
import numpy as np
import re
from typing import List, Dict, Set
import logging
import json
import os
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimplePDFFactChecker:
    def __init__(self, pdf_directory="Papers/", chunk_size=800, overlap=200):
        self.pdf_directory = Path(pdf_directory)
        self.chunk_size = chunk_size  # Reduced chunk size
        self.overlap = overlap  # Reduced overlap
        self.metadata_file = Path("pdf_metadata.json")
        
        # Initialize embedding model only
        logger.info("Loading embedding model...")
        try:
            self.embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
        
        # Initialize ChromaDB with error handling
        try:
            self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {e}")
            raise
        
        # Get or create collection with error handling
        try:
            self.collection = self.chroma_client.get_collection(name="new_updated_factcheck_collection")
            logger.info("Loaded existing collection")
        except Exception:
            try:
                self.collection = self.chroma_client.create_collection(name="new_updated_factcheck_collection")
                logger.info("Created new collection")
            except Exception as e:
                logger.error(f"Failed to create collection: {e}")
                raise
        
        # Check for new or updated PDFs with error handling
        try:
            self._update_database_if_needed()
        except Exception as e:
            logger.error(f"Error during database update: {e}")
            # Continue execution even if update fails
    
    def _load_pdf_metadata(self) -> Dict:
        """Load metadata about processed PDFs"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Error loading metadata file: {e}")
                return {}
        return {}
    
    def _save_pdf_metadata(self, metadata: Dict):
        """Save metadata about processed PDFs"""
        try:
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving metadata file: {e}")
    
    def _get_pdf_info(self, pdf_path: Path) -> Dict:
        """Get information about a PDF file"""
        stat = pdf_path.stat()
        return {
            'name': pdf_path.name,
            'size': stat.st_size,
            'modified': stat.st_mtime,
            'path': str(pdf_path)
        }
    
    def _find_new_or_updated_pdfs(self) -> List[Path]:
        """Find PDFs that are new or have been updated since last processing"""
        current_metadata = self._load_pdf_metadata()
        pdf_files = list(self.pdf_directory.glob("*.pdf"))
        
        if not pdf_files:
            logger.warning(f"No PDF files found in {self.pdf_directory}")
            return []
        
        new_or_updated = []
        
        for pdf_path in pdf_files:
            pdf_info = self._get_pdf_info(pdf_path)
            pdf_name = pdf_path.name
            
            if (pdf_name not in current_metadata or 
                current_metadata[pdf_name]['modified'] != pdf_info['modified'] or
                current_metadata[pdf_name]['size'] != pdf_info['size']):
                
                new_or_updated.append(pdf_path)
                logger.info(f"Found new/updated PDF: {pdf_name}")
        
        return new_or_updated
    
    def _remove_old_chunks(self, pdf_name: str):
        """Remove chunks from a PDF that was updated"""
        logger.info(f"Removing old chunks for {pdf_name}")
        
        # Get all IDs for this PDF
        pdf_stem = Path(pdf_name).stem
        ids_to_remove = []
        
        # Batch query to find all chunks for this PDF
        offset = 0
        while True:
            batch = self.collection.get(
                limit=100, 
                offset=offset,
                where={"source": pdf_name}
            )
            if not batch['ids']:
                break
            ids_to_remove.extend(batch['ids'])
            offset += 100
        
        # Remove old chunks
        if ids_to_remove:
            logger.info(f"Removing {len(ids_to_remove)} old chunks for {pdf_name}")
            self.collection.delete(ids=ids_to_remove)
    
    def _update_database_if_needed(self):
        """Update the vector database with new or updated PDFs"""
        new_or_updated_pdfs = self._find_new_or_updated_pdfs()
        
        if not new_or_updated_pdfs:
            logger.info("No new or updated PDFs found. Database is up to date.")
            return
        
        logger.info(f"Found {len(new_or_updated_pdfs)} new/updated PDFs. Updating database...")
        
        current_metadata = self._load_pdf_metadata()
        
        for pdf_path in new_or_updated_pdfs:
            # Remove old chunks if PDF was updated
            if pdf_path.name in current_metadata:
                self._remove_old_chunks(pdf_path.name)
            
            # Process the PDF
            self._process_single_pdf(pdf_path)
            
            # Update metadata
            current_metadata[pdf_path.name] = self._get_pdf_info(pdf_path)
        
        # Save updated metadata
        self._save_pdf_metadata(current_metadata)
        logger.info("Database update completed!")
    
    def _process_single_pdf(self, pdf_path: Path):
        """Process a single PDF file with robust error handling"""
        logger.info(f"Processing {pdf_path.name}")
        
        try:
            with pymupdf.open(pdf_path) as doc:
                text = ""
                page_count = len(doc)
                logger.info(f"PDF has {page_count} pages")
                
                for page_num, page in enumerate(doc):
                    try:
                        page_text = page.get_text()
                        if page_text and page_text.strip():
                            text += f" {page_text}"
                        
                        # Progress logging for large PDFs
                        if page_num % 10 == 0:
                            logger.info(f"Processed page {page_num + 1}/{page_count}")
                    except Exception as e:
                        logger.warning(f"Error processing page {page_num + 1}: {e}")
                        continue

                logger.info(f"Extracted {len(text)} characters from {pdf_path.name}")
                
                if not text.strip():
                    logger.warning(f"No text extracted from {pdf_path.name}")
                    return
                
                cleaned_text = self.clean_text(text)
                logger.info(f"Cleaned text: {len(cleaned_text)} characters")
                
                if not cleaned_text:
                    logger.warning(f"No valid text after cleaning from {pdf_path.name}")
                    return
                
                chunks = self.chunk_text_with_overlap(cleaned_text)
                logger.info(f"Created {len(chunks)} chunks from {pdf_path.name}")
                
                if not chunks:
                    logger.warning(f"No valid chunks created from {pdf_path.name}")
                    return

                metadata = doc.metadata or {}

                chunks_to_add = []
                ids_to_add = []
                metadatas_to_add = []

                for i, chunk in enumerate(chunks):
                    chunk_id = f"{pdf_path.stem}_chunk_{i}"
                    chunks_to_add.append(chunk)
                    ids_to_add.append(chunk_id)
                    metadatas_to_add.append({
                        'source': pdf_path.name,
                        'chunk_id': i,
                        'title': metadata.get('title', pdf_path.stem),
                        'author': metadata.get('author', 'Unknown'),
                        'processed_date': datetime.now().isoformat(),
                        'chunk_length': len(chunk)
                    })

                if chunks_to_add:
                    logger.info(f"Generating embeddings for {len(chunks_to_add)} chunks...")
                    try:
                        embeddings = self.embedding_model.encode(
                            chunks_to_add,
                            batch_size=4,  # Reduced batch size for stability
                            show_progress_bar=True,
                            convert_to_numpy=True
                        )

                        logger.info(f"Adding {len(chunks_to_add)} chunks to collection...")
                        
                        # Add chunks in smaller batches to avoid memory issues
                        batch_size = 10
                        for i in range(0, len(chunks_to_add), batch_size):
                            end_idx = min(i + batch_size, len(chunks_to_add))
                            batch_chunks = chunks_to_add[i:end_idx]
                            batch_embeddings = embeddings[i:end_idx]
                            batch_metadatas = metadatas_to_add[i:end_idx]
                            batch_ids = ids_to_add[i:end_idx]
                            
                            self.collection.add(
                                documents=batch_chunks,
                                embeddings=batch_embeddings.tolist(),
                                metadatas=batch_metadatas,
                                ids=batch_ids
                            )
                            logger.info(f"Added batch {i//batch_size + 1} of {(len(chunks_to_add)-1)//batch_size + 1}")
                        
                        logger.info(f"Successfully processed {pdf_path.name}")
                    except Exception as e:
                        logger.error(f"Error generating embeddings or adding to collection: {e}")
                        raise
                
        except Exception as e:
            logger.error(f"Error processing {pdf_path}: {e}")
            raise
    
    def force_update(self):
        """Force update of all PDFs, regardless of modification time"""
        logger.info("Forcing complete database update...")
        
        # Clear existing metadata
        if self.metadata_file.exists():
            self.metadata_file.unlink()
        
        # Clear collection
        try:
            self.chroma_client.delete_collection("new_updated_factcheck_collection")
        except:
            pass
        
        # Recreate collection
        self.collection = self.chroma_client.create_collection(name="new_updated_factcheck_collection")
        
        # Process all PDFs
        self._update_database_if_needed()
    
    def get_database_stats(self) -> Dict:
        """Get statistics about the current database"""
        try:
            # Count total chunks
            total_chunks = self.collection.count()
            
            # Get unique sources
            sources = set()
            offset = 0
            while True:
                batch = self.collection.get(limit=100, offset=offset)
                if not batch['ids']:
                    break
                for metadata in batch['metadatas']:
                    sources.add(metadata.get('source', 'Unknown'))
                offset += 100
            
            return {
                'total_chunks': total_chunks,
                'unique_sources': len(sources),
                'sources': list(sources)
            }
        except Exception as e:
            logger.error(f"Error getting database stats: {e}")
            return {'error': str(e)}
    
    def clean_text(self, text: str) -> str:
        """Clean extracted text from PDFs with robust error handling"""
        try:
            if not text or len(text.strip()) == 0:
                return ""
            
            # Remove common PDF artifacts
            text = re.sub(r'Page \d+ of \d+', '', text)
            text = re.sub(r'\d+%', '', text)  # Remove percentage values like 50%, 75%, etc.
            text = re.sub(r'Actual Size|Page Fit|Page Width|Zoom', '', text)
            text = re.sub(r'https?://[^\s]+', '', text)  # Remove URLs
            text = re.sub(r'◦|•', '', text)  # Remove bullet points
            
            # Normalize whitespace
            text = re.sub(r'\s+', ' ', text)
            
            # Remove special characters but keep basic punctuation
            text = re.sub(r'[^\w\s.,;:!?()\-–—\'\"°%&]', ' ', text)
            
            # Remove very short words (likely artifacts) but keep common short words
            common_short_words = {'a', 'an', 'and', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we'}
            words = text.split()
            filtered_words = []
            for word in words:
                if len(word) > 2 or word.lower() in common_short_words:
                    filtered_words.append(word)
            text = ' '.join(filtered_words)
            
            # Remove extra spaces and clean up
            text = re.sub(r'\s+', ' ', text).strip()
            
            return text
        except Exception as e:
            logger.warning(f"Error cleaning text: {e}")
            return text.strip() if text else ""
    
    def chunk_text_with_overlap(self, text: str) -> List[str]:
        """Create overlapping chunks to preserve context with better error handling"""
        try:
            if not text or len(text.strip()) < 50:
                return []
            
            chunks = []
            start = 0
            text_len = len(text)
            
            while start < text_len:
                end = min(start + self.chunk_size, text_len)
                chunk = text[start:end]
                
                # Try to break at sentence boundaries
                if end < text_len and not text[end].isspace():
                    # Look for sentence ending first
                    sentence_end = max(
                        chunk.rfind('.'), 
                        chunk.rfind('!'), 
                        chunk.rfind('?')
                    )
                    if sentence_end > start + self.chunk_size // 3:
                        end = start + sentence_end + 1
                        chunk = text[start:end]
                    else:
                        # Fall back to word boundary
                        last_space = chunk.rfind(' ')
                        if last_space > start + self.chunk_size // 2:
                            end = start + last_space
                            chunk = text[start:end]
                
                chunk = chunk.strip()
                if len(chunk) > 100:  # Increased minimum chunk size
                    chunks.append(chunk)
                
                start = end - self.overlap
                
                if start >= text_len:
                    break
                    
            # Filter out chunks that are too short or contain mostly artifacts
            valid_chunks = []
            for chunk in chunks:
                # Check if chunk has reasonable content
                words = chunk.split()
                if len(words) >= 10 and len(chunk) >= 100:
                    valid_chunks.append(chunk)
            
            return valid_chunks
        except Exception as e:
            logger.error(f"Error chunking text: {e}")
            return []
    
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
    
    def simple_fact_check(self, message: str, similarity_threshold: float = 0.6) -> Dict:
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
                results['confidence'] = min(results['confidence'], 0.6)
                
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
    # Initialize the fact checker (will automatically update if needed)
    factchecker = SimplePDFFactChecker()
    
    # Show database statistics
    stats = factchecker.get_database_stats()
    print(f"Database Statistics:")
    print(f"- Total chunks: {stats.get('total_chunks', 0)}")
    print(f"- Unique sources: {stats.get('unique_sources', 0)}")
    print(f"- Sources: {stats.get('sources', [])}")
    
    # Example: Force update all PDFs
    # factchecker.force_update()
    
    # Example messages to check
    test_messages = [
        "PSUIs are useful.",
        "Password Managers are unsave", 
        "Long passwords are secure."
    ]
    
    for message in test_messages:
        print(f"\n{'='*50}")
        print(f"Testing: {message}")
        print('='*50)
        
        results = factchecker.simple_fact_check(message)
        formatted_response = factchecker.format_simple_response(results)
        print(formatted_response)