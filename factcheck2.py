import pymupdf
from sentence_transformers import SentenceTransformer
import chromadb
from pathlib import Path
import numpy as np
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import re
from typing import List, Dict, Tuple
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PDFFactChecker:
    def __init__(self, pdf_directory="Papers/", chunk_size=300, overlap=50):
        self.pdf_directory = Path(pdf_directory)
        self.chunk_size = chunk_size
        self.overlap = overlap
        
        # Initialize models
        logger.info("Loading models...")
        self.embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        
        # Load DeBERTa for fact checking (using a model fine-tuned for NLI)
        self.tokenizer = AutoTokenizer.from_pretrained('microsoft/deberta-v3-base')
        self.factcheck_model = AutoModelForSequenceClassification.from_pretrained(
            'microsoft/deberta-v3-base'
        )
        
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
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters that might interfere
        text = re.sub(r'[^\w\s.,;:!?()-]', '', text)
        # Remove very short fragments
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
            
            # Ensure we don't cut words in the middle
            if end < text_len and not text[end].isspace():
                last_space = chunk.rfind(' ')
                if last_space > start + self.chunk_size // 2:
                    end = start + last_space
                    chunk = text[start:end]
            
            chunks.append(chunk.strip())
            start = end - self.overlap
            
            if start >= text_len:
                break
                
        return [chunk for chunk in chunks if len(chunk) > 50]  # Filter very short chunks
    
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
                        if page_text.strip():  # Only add non-empty pages
                            text += f" {page_text}"
                    
                    # Clean and chunk the text
                    cleaned_text = self.clean_text(text)
                    chunks = self.chunk_text_with_overlap(cleaned_text)
                    
                    # Create metadata for each chunk
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
            # Generate embeddings
            logger.info("Generating embeddings...")
            embeddings = self.embedding_model.encode(
                all_chunks,
                batch_size=16,
                show_progress_bar=True,
                convert_to_numpy=True
            )
            
            # Store in ChromaDB
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
    
    def check_claim_against_evidence(self, claim: str, evidence: str) -> Dict:
        """Use DeBERTa to check if claim is supported by evidence"""
        # Prepare input for NLI (Natural Language Inference)
        premise = evidence[:512]  # Truncate to model limits
        hypothesis = claim[:512]
        
        # Tokenize input
        inputs = self.tokenizer(
            premise, 
            hypothesis, 
            return_tensors="pt", 
            truncation=True, 
            padding=True, 
            max_length=512
        )
        
        # Get model prediction
        with torch.no_grad():
            outputs = self.factcheck_model(**inputs)
            predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
        
        # Interpret results (assuming ENTAILMENT, NEUTRAL, CONTRADICTION)
        labels = ['ENTAILMENT', 'NEUTRAL', 'CONTRADICTION']
        predicted_label = labels[torch.argmax(predictions, dim=-1).item()]
        confidence = torch.max(predictions).item()
        
        return {
            'label': predicted_label,
            'confidence': confidence,
            'evidence': evidence
        }
    
    def fact_check_message(self, message: str, confidence_threshold: float = 0.7) -> Dict:
        """Main fact-checking function"""
        logger.info(f"Fact-checking message: {message[:100]}...")
        
        # Extract claims/statements from the message
        sentences = re.split(r'[.!?]+', message)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
        
        results = {
            'is_factual': True,
            'overall_confidence': 1.0,
            'claim_results': [],
            'sources': []
        }
        
        for sentence in sentences:
            # Skip very short or non-factual sentences
            if len(sentence) < 20 or any(word in sentence.lower() for word in ['i think', 'maybe', 'perhaps', 'opinion']):
                continue
            
            # Retrieve relevant context
            relevant_chunks = self.retrieve_relevant_context(sentence, top_k=3)
            
            if not relevant_chunks:
                continue
            
            # Check each claim against the most relevant evidence
            best_match = None
            best_confidence = 0
            
            for chunk in relevant_chunks:
                if chunk['distance'] < 0.5:  # Only consider relatively similar chunks
                    check_result = self.check_claim_against_evidence(sentence, chunk['text'])
                    
                    if check_result['confidence'] > best_confidence:
                        best_confidence = check_result['confidence']
                        best_match = {
                            'claim': sentence,
                            'result': check_result,
                            'source': chunk['metadata']
                        }
            
            if best_match and best_confidence > confidence_threshold:
                results['claim_results'].append(best_match)
                
                # Add source information
                source_info = {
                    'title': best_match['source']['title'],
                    'source': best_match['source']['source']
                }
                if source_info not in results['sources']:
                    results['sources'].append(source_info)
                
                # Check if any claim is contradicted
                if best_match['result']['label'] == 'CONTRADICTION':
                    results['is_factual'] = False
                    results['overall_confidence'] = min(results['overall_confidence'], 
                                                      1 - best_match['result']['confidence'])
        
        return results
    
    def format_fact_check_response(self, results: Dict) -> str:
        """Format the fact-check results for user display"""
        if results['is_factual']:
            response = "✅ **Nachricht ist faktisch korrekt**\n\n"
        else:
            response = "❌ **Nachricht enthält möglicherweise falsche Informationen**\n\n"
        
        # Add details about specific claims
        for claim_result in results['claim_results']:
            claim = claim_result['claim']
            label = claim_result['result']['label']
            confidence = claim_result['result']['confidence']
            
            if label == 'CONTRADICTION':
                response += f"🚫 **Widerspruch gefunden:**\n"
                response += f"Behauptung: \"{claim}\"\n"
                response += f"Konfidenz: {confidence:.2%}\n\n"
            elif label == 'ENTAILMENT':
                response += f"✅ **Unterstützt:**\n"
                response += f"Behauptung: \"{claim}\"\n"
                response += f"Konfidenz: {confidence:.2%}\n\n"
        
        # Add sources
        if results['sources']:
            response += "**Quellen:**\n"
            for source in results['sources']:
                response += f"- {source['title']} ({source['source']})\n"
        
        return response

# Example usage
if __name__ == "__main__":
    # Initialize the fact checker
    factchecker = PDFFactChecker()
    
    # Example messages to check
    test_messages = [
        "Klimawandel ist ein natürliches Phänomen und hat nichts mit menschlichen Aktivitäten zu tun.",
        "COVID-19 Impfstoffe haben in klinischen Studien eine hohe Wirksamkeit gezeigt.",
        "Die Erde ist flach und alle Weltraumbilder sind gefälscht."
    ]
    
    for message in test_messages:
        print(f"\n{'='*50}")
        print(f"Testing: {message}")
        print('='*50)
        
        results = factchecker.fact_check_message(message)
        formatted_response = factchecker.format_fact_check_response(results)
        print(formatted_response)