import pymupdf
from sentence_transformers import SentenceTransformer
import chromadb
from pathlib import Path
import numpy as np
import re
from typing import List, Dict, Set, Optional
import logging
import json
import os
from datetime import datetime
import gc
import psutil
import threading
import time

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimplePDFFactChecker:
    def __init__(self, pdf_directory="Papers/", chunk_size=500, overlap=100, max_memory_gb=4):
        self.pdf_directory = Path(pdf_directory)
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.max_memory_gb = max_memory_gb
        self.metadata_file = Path("pdf_metadata.json")
        self.processing_lock = threading.Lock()
        
        # Memory monitoring
        self.memory_monitor = MemoryMonitor(max_memory_gb)
        
        # Initialize components with memory checks
        self._initialize_components()
        
    def _initialize_components(self):
        """Initialize all components with memory monitoring"""
        logger.info("Initializing components...")
        
        # Check initial memory
        self.memory_monitor.check_memory("Initial")
        
        # Initialize embedding model with error handling
        logger.info("Loading embedding model...")
        try:
            # Use a smaller model to reduce memory usage
            self.embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
            self.embedding_model.max_seq_length = 256  # Limit sequence length
            
            # Force garbage collection after model loading
            gc.collect()
            self.memory_monitor.check_memory("After model loading")
            
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
        
        # Initialize ChromaDB with new client format
        try:
            # Use the new ChromaDB client initialization
            self.chroma_client = chromadb.PersistentClient(path="./chroma_db")
            self.memory_monitor.check_memory("After ChromaDB init")
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {e}")
            raise
        
        # Get or create collection
        try:
            self.collection = self.chroma_client.get_collection(name="factcheck_collection")
            logger.info("Loaded existing collection")
        except Exception:
            try:
                self.collection = self.chroma_client.create_collection(name="factcheck_collection")
                logger.info("Created new collection")
            except Exception as e:
                logger.error(f"Failed to create collection: {e}")
                raise
        
        # Check for updates with memory monitoring
        try:
            self._update_database_if_needed()
        except Exception as e:
            logger.error(f"Error during database update: {e}")
    
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
        """Find PDFs that are new or have been updated"""
        current_metadata = self._load_pdf_metadata()
        
        try:
            pdf_files = list(self.pdf_directory.glob("*.pdf"))
        except Exception as e:
            logger.error(f"Error accessing PDF directory: {e}")
            return []
        
        if not pdf_files:
            logger.warning(f"No PDF files found in {self.pdf_directory}")
            return []
        
        # Limit the number of PDFs processed at once
        max_pdfs_per_batch = 3
        pdf_files = pdf_files[:max_pdfs_per_batch]
        
        new_or_updated = []
        
        for pdf_path in pdf_files:
            try:
                pdf_info = self._get_pdf_info(pdf_path)
                pdf_name = pdf_path.name
                
                if (pdf_name not in current_metadata or 
                    current_metadata[pdf_name]['modified'] != pdf_info['modified'] or
                    current_metadata[pdf_name]['size'] != pdf_info['size']):
                    
                    new_or_updated.append(pdf_path)
                    logger.info(f"Found new/updated PDF: {pdf_name}")
            except Exception as e:
                logger.warning(f"Error checking PDF {pdf_path}: {e}")
                continue
        
        return new_or_updated
    
    def _remove_old_chunks(self, pdf_name: str):
        """Remove chunks from a PDF that was updated"""
        logger.info(f"Removing old chunks for {pdf_name}")
        
        try:
            # Get all IDs for this PDF in smaller batches
            ids_to_remove = []
            batch_size = 50  # Smaller batch size
            offset = 0
            
            while True:
                try:
                    batch = self.collection.get(
                        limit=batch_size, 
                        offset=offset,
                        where={"source": pdf_name}
                    )
                    if not batch['ids']:
                        break
                    ids_to_remove.extend(batch['ids'])
                    offset += batch_size
                    
                    # Memory check during batch processing
                    if offset % 200 == 0:
                        self.memory_monitor.check_memory(f"Removing chunks batch {offset}")
                        
                except Exception as e:
                    logger.warning(f"Error in batch removal: {e}")
                    break
            
            # Remove old chunks in smaller batches
            if ids_to_remove:
                logger.info(f"Removing {len(ids_to_remove)} old chunks for {pdf_name}")
                remove_batch_size = 100
                
                for i in range(0, len(ids_to_remove), remove_batch_size):
                    batch_ids = ids_to_remove[i:i+remove_batch_size]
                    try:
                        self.collection.delete(ids=batch_ids)
                        gc.collect()  # Force garbage collection
                    except Exception as e:
                        logger.warning(f"Error removing batch of chunks: {e}")
                        
        except Exception as e:
            logger.error(f"Error removing old chunks: {e}")
    
    def _update_database_if_needed(self):
        """Update the vector database with new or updated PDFs"""
        with self.processing_lock:
            new_or_updated_pdfs = self._find_new_or_updated_pdfs()
            
            if not new_or_updated_pdfs:
                logger.info("No new or updated PDFs found. Database is up to date.")
                return
            
            logger.info(f"Found {len(new_or_updated_pdfs)} new/updated PDFs. Updating database...")
            
            current_metadata = self._load_pdf_metadata()
            
            for pdf_path in new_or_updated_pdfs:
                try:
                    # Memory check before processing each PDF
                    self.memory_monitor.check_memory(f"Before processing {pdf_path.name}")
                    
                    # Remove old chunks if PDF was updated
                    if pdf_path.name in current_metadata:
                        self._remove_old_chunks(pdf_path.name)
                    
                    # Process the PDF
                    self._process_single_pdf(pdf_path)
                    
                    # Update metadata
                    current_metadata[pdf_path.name] = self._get_pdf_info(pdf_path)
                    
                    # Force garbage collection after each PDF
                    gc.collect()
                    
                except Exception as e:
                    logger.error(f"Error processing {pdf_path.name}: {e}")
                    continue
            
            # Save updated metadata
            self._save_pdf_metadata(current_metadata)
            logger.info("Database update completed!")
    
    def _process_single_pdf(self, pdf_path: Path):
        """Process a single PDF file with memory management"""
        logger.info(f"Processing {pdf_path.name}")
        
        try:
            # Check file size before processing
            file_size_mb = pdf_path.stat().st_size / (1024 * 1024)
            if file_size_mb > 50:  # Skip very large files
                logger.warning(f"Skipping large file {pdf_path.name} ({file_size_mb:.1f}MB)")
                return
            
            with pymupdf.open(pdf_path) as doc:
                text = ""
                page_count = len(doc)
                
                # Limit the number of pages processed
                max_pages = min(page_count, 100)
                logger.info(f"PDF has {page_count} pages, processing first {max_pages}")
                
                for page_num in range(max_pages):
                    try:
                        page = doc[page_num]
                        page_text = page.get_text()
                        
                        if page_text and page_text.strip():
                            text += f" {page_text}"
                        
                        # Memory check every 10 pages
                        if page_num % 10 == 0:
                            self.memory_monitor.check_memory(f"Page {page_num + 1}/{max_pages}")
                        
                        # Clear page from memory
                        del page_text
                        
                    except Exception as e:
                        logger.warning(f"Error processing page {page_num + 1}: {e}")
                        continue

                logger.info(f"Extracted {len(text)} characters from {pdf_path.name}")
                
                if not text.strip():
                    logger.warning(f"No text extracted from {pdf_path.name}")
                    return
                
                # Clean and chunk text
                cleaned_text = self.clean_text(text)
                del text  # Free memory
                gc.collect()
                
                logger.info(f"Cleaned text: {len(cleaned_text)} characters")
                
                if not cleaned_text:
                    logger.warning(f"No valid text after cleaning from {pdf_path.name}")
                    return
                
                chunks = self.chunk_text_with_overlap(cleaned_text)
                del cleaned_text  # Free memory
                gc.collect()
                
                logger.info(f"Created {len(chunks)} chunks from {pdf_path.name}")
                
                if not chunks:
                    logger.warning(f"No valid chunks created from {pdf_path.name}")
                    return

                # Process chunks in smaller batches
                self._process_chunks_in_batches(chunks, pdf_path, doc.metadata or {})
                
        except Exception as e:
            logger.error(f"Error processing {pdf_path}: {e}")
            raise
    
    def _process_chunks_in_batches(self, chunks: List[str], pdf_path: Path, metadata: Dict):
        """Process chunks in smaller batches to manage memory"""
        batch_size = 5  # Very small batch size
        total_batches = (len(chunks) + batch_size - 1) // batch_size
        
        for batch_idx in range(0, len(chunks), batch_size):
            try:
                batch_chunks = chunks[batch_idx:batch_idx + batch_size]
                
                # Prepare batch data
                chunks_to_add = []
                ids_to_add = []
                metadatas_to_add = []
                
                for i, chunk in enumerate(batch_chunks):
                    chunk_id = f"{pdf_path.stem}_chunk_{batch_idx + i}"
                    chunks_to_add.append(chunk)
                    ids_to_add.append(chunk_id)
                    metadatas_to_add.append({
                        'source': pdf_path.name,
                        'chunk_id': batch_idx + i,
                        'title': metadata.get('title', pdf_path.stem),
                        'author': metadata.get('author', 'Unknown'),
                        'processed_date': datetime.now().isoformat(),
                        'chunk_length': len(chunk)
                    })
                
                # Generate embeddings for batch
                logger.info(f"Processing batch {batch_idx//batch_size + 1}/{total_batches}")
                
                try:
                    embeddings = self.embedding_model.encode(
                        chunks_to_add,
                        batch_size=2,  # Very small batch size for encoding
                        show_progress_bar=False,
                        convert_to_numpy=True
                    )
                    
                    # Add to collection
                    self.collection.add(
                        documents=chunks_to_add,
                        embeddings=embeddings.tolist(),
                        metadatas=metadatas_to_add,
                        ids=ids_to_add
                    )
                    
                    # Clean up
                    del embeddings
                    del chunks_to_add
                    del ids_to_add
                    del metadatas_to_add
                    gc.collect()
                    
                    # Memory check after each batch
                    self.memory_monitor.check_memory(f"After batch {batch_idx//batch_size + 1}")
                    
                except Exception as e:
                    logger.error(f"Error processing batch {batch_idx//batch_size + 1}: {e}")
                    continue
                    
            except Exception as e:
                logger.error(f"Error in batch processing: {e}")
                continue
    
    def clean_text(self, text: str) -> str:
        """Clean extracted text from PDFs"""
        try:
            if not text or len(text.strip()) == 0:
                return ""
            
            # More aggressive cleaning for memory efficiency
            text = re.sub(r'Page \d+ of \d+', '', text)
            text = re.sub(r'\d+%', '', text)
            text = re.sub(r'Actual Size|Page Fit|Page Width|Zoom', '', text)
            text = re.sub(r'https?://[^\s]+', '', text)
            text = re.sub(r'[◦•▪▫]', '', text)
            
            # Normalize whitespace
            text = re.sub(r'\s+', ' ', text)
            
            # Remove special characters
            text = re.sub(r'[^\w\s.,;:!?()\-–—\'\"°%&]', ' ', text)
            
            # Remove very short words
            common_short_words = {'a', 'an', 'and', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we'}
            words = text.split()
            filtered_words = [word for word in words if len(word) > 2 or word.lower() in common_short_words]
            text = ' '.join(filtered_words)
            
            # Final cleanup
            text = re.sub(r'\s+', ' ', text).strip()
            
            return text
        except Exception as e:
            logger.warning(f"Error cleaning text: {e}")
            return text.strip() if text else ""
    
    def chunk_text_with_overlap(self, text: str) -> List[str]:
        """Create overlapping chunks with memory efficiency"""
        try:
            if not text or len(text.strip()) < 50:
                return []
            
            chunks = []
            start = 0
            text_len = len(text)
            
            while start < text_len:
                end = min(start + self.chunk_size, text_len)
                chunk = text[start:end]
                
                # Break at sentence boundaries
                if end < text_len and not text[end].isspace():
                    sentence_end = max(chunk.rfind('.'), chunk.rfind('!'), chunk.rfind('?'))
                    if sentence_end > start + self.chunk_size // 3:
                        end = start + sentence_end + 1
                        chunk = text[start:end]
                    else:
                        last_space = chunk.rfind(' ')
                        if last_space > start + self.chunk_size // 2:
                            end = start + last_space
                            chunk = text[start:end]
                
                chunk = chunk.strip()
                if len(chunk) > 50:  # Smaller minimum chunk size
                    chunks.append(chunk)
                
                start = end - self.overlap
                
                if start >= text_len:
                    break
            
            # Filter valid chunks
            valid_chunks = [chunk for chunk in chunks if len(chunk.split()) >= 5 and len(chunk) >= 50]
            
            return valid_chunks
        except Exception as e:
            logger.error(f"Error chunking text: {e}")
            return []
    
    def retrieve_relevant_context(self, query: str, top_k: int = 3) -> List[Dict]:
        """Retrieve most relevant chunks for a given query"""
        try:
            query_embedding = self.embedding_model.encode([query])
            
            results = self.collection.query(
                query_embeddings=query_embedding.tolist(),
                n_results=min(top_k, 10)  # Limit results
            )
            
            relevant_chunks = []
            for i in range(len(results['documents'][0])):
                relevant_chunks.append({
                    'text': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'distance': results['distances'][0][i]
                })
            
            return relevant_chunks
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return []
    
    def simple_fact_check(self, message: str, similarity_threshold: float = 0.6) -> Dict:
        """Simple fact-checking with memory management"""
        logger.info(f"Fact-checking message: {message[:100]}...")
        
        try:
            # Extract claims
            sentences = re.split(r'[.!?]+', message)
            sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
            
            # Limit number of sentences processed
            sentences = sentences[:5]
            
            results = {
                'is_supported': True,
                'confidence': 1.0,
                'claim_results': [],
                'sources': []
            }
            
            for sentence in sentences:
                if len(sentence) < 20:
                    continue
                
                try:
                    # Retrieve relevant context
                    relevant_chunks = self.retrieve_relevant_context(sentence, top_k=3)
                    
                    if relevant_chunks and relevant_chunks[0]['distance'] < similarity_threshold:
                        best_match = relevant_chunks[0]
                        confidence = 1 - best_match['distance']
                        
                        results['claim_results'].append({
                            'claim': sentence,
                            'confidence': confidence,
                            'supporting_text': best_match['text'][:200] + "...",
                            'source': best_match['metadata']
                        })
                        
                        source_info = {
                            'title': best_match['metadata']['title'],
                            'source': best_match['metadata']['source']
                        }
                        if source_info not in results['sources']:
                            results['sources'].append(source_info)
                    else:
                        results['is_supported'] = False
                        results['confidence'] = min(results['confidence'], 0.6)
                        
                        results['claim_results'].append({
                            'claim': sentence,
                            'confidence': 0.0,
                            'supporting_text': "Keine unterstützenden Belege gefunden",
                            'source': None
                        })
                except Exception as e:
                    logger.warning(f"Error processing sentence: {e}")
                    continue
            
            return results
        except Exception as e:
            logger.error(f"Error in fact checking: {e}")
            return {
                'is_supported': False,
                'confidence': 0.0,
                'claim_results': [],
                'sources': [],
                'error': str(e)
            }
    
    def format_simple_response(self, results: Dict) -> str:
        """Format the simple fact-check results"""
        if 'error' in results:
            return f"❌ **Fehler beim Fact-Check**: {results['error']}"
        
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
    
    def get_database_stats(self) -> Dict:
        """Get database statistics with error handling"""
        try:
            total_chunks = self.collection.count()
            
            sources = set()
            batch_size = 50
            offset = 0
            
            while True:
                try:
                    batch = self.collection.get(limit=batch_size, offset=offset)
                    if not batch['ids']:
                        break
                    for metadata in batch['metadatas']:
                        sources.add(metadata.get('source', 'Unknown'))
                    offset += batch_size
                except Exception as e:
                    logger.warning(f"Error getting batch: {e}")
                    break
            
            return {
                'total_chunks': total_chunks,
                'unique_sources': len(sources),
                'sources': list(sources)
            }
        except Exception as e:
            logger.error(f"Error getting database stats: {e}")
            return {'error': str(e)}
    
    def cleanup(self):
        """Clean up resources"""
        try:
            if hasattr(self, 'collection'):
                del self.collection
            if hasattr(self, 'chroma_client'):
                del self.chroma_client
            if hasattr(self, 'embedding_model'):
                del self.embedding_model
            gc.collect()
            logger.info("Cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")


class MemoryMonitor:
    """Monitor memory usage and provide warnings"""
    
    def __init__(self, max_memory_gb: float = 4.0):
        self.max_memory_gb = max_memory_gb
        self.max_memory_bytes = max_memory_gb * 1024 * 1024 * 1024
        
    def check_memory(self, context: str = ""):
        """Check current memory usage"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            memory_gb = memory_mb / 1024
            
            logger.info(f"Memory usage {context}: {memory_mb:.1f} MB ({memory_gb:.2f} GB)")
            
            if memory_info.rss > self.max_memory_bytes:
                logger.warning(f"Memory usage high: {memory_gb:.2f} GB (limit: {self.max_memory_gb} GB)")
                gc.collect()
                
                # Check again after garbage collection
                memory_info = process.memory_info()
                memory_gb = memory_info.rss / 1024 / 1024 / 1024
                logger.info(f"Memory after cleanup: {memory_gb:.2f} GB")
                
                if memory_info.rss > self.max_memory_bytes:
                    raise MemoryError(f"Memory limit exceeded: {memory_gb:.2f} GB")
            
            return memory_gb
        except Exception as e:
            logger.warning(f"Error checking memory: {e}")
            return 0


# Example usage with better error handling
if __name__ == "__main__":
    factchecker = None
    try:
        # Initialize with conservative settings
        factchecker = SimplePDFFactChecker(
            chunk_size=400,
            overlap=50,
            max_memory_gb=3.0
        )
        
        # Show database statistics
        stats = factchecker.get_database_stats()
        print(f"Database Statistics:")
        print(f"- Total chunks: {stats.get('total_chunks', 0)}")
        print(f"- Unique sources: {stats.get('unique_sources', 0)}")
        print(f"- Sources: {stats.get('sources', [])}")
        
        # Test messages
        test_messages = [
            "PSUIs are useful.",
            "Password Managers are unsafe", 
            "Long passwords are secure."
        ]
        
        for message in test_messages:
            print(f"\n{'='*50}")
            print(f"Testing: {message}")
            print('='*50)
            
            try:
                results = factchecker.simple_fact_check(message)
                formatted_response = factchecker.format_simple_response(results)
                print(formatted_response)
            except Exception as e:
                print(f"Error processing message: {e}")
                
    except Exception as e:
        print(f"Error initializing fact checker: {e}")
    finally:
        if factchecker:
            factchecker.cleanup()