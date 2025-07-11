from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import threading
import time
from SimplePDFFactChecker  import SimplePDFFactChecker  

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Front End

# global factcheck variable
factchecker = None
factchecker_lock = threading.Lock()

def initialize_factchecker():
    """Initialisiere den Factchecker in einem separaten Thread"""
    global factchecker
    try:
        logger.info("Initialisiere Factchecker...")
        factchecker = SimplePDFFactChecker(
            chunk_size=400,
            overlap=50,
            max_memory_gb=3.0
        )
        logger.info("Factchecker erfolgreich initialisiert")
    except Exception as e:
        logger.error(f"Fehler beim Initialisieren des Factcheckers: {e}")
        factchecker = None

@app.route('/api/factcheck', methods=['POST'])
def factcheck_message():
    """API Endpoint für Fact-Checking"""
    try:
        
        if factchecker is None:
            return jsonify({
                'error': 'Factchecker nicht verfügbar',
                'success': False
            }), 503
        
    
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                'error': 'Keine Nachricht empfangen',
                'success': False
            }), 400
        
        message = data['message'].strip()
        if not message:
            return jsonify({
                'error': 'Leere Nachricht',
                'success': False
            }), 400

        with factchecker_lock:
            logger.info(f"Fact-checking: {message[:100]}...")

            results = factchecker.simple_fact_check(message)
            formatted_response = factchecker.format_simple_response(results)
            
            # status of confidence
            status = "verified" if results['is_supported'] else "unverified"
            if results['confidence'] > 0.7:
                status = "verified"
            elif results['confidence'] > 0.3:
                status = "partial"
            else:
                status = "unverified"
            
            response = {
                'success': True,
                'status': status,
                'confidence': results['confidence'],
                'is_supported': results['is_supported'],
                'formatted_response': formatted_response,
                'claim_results': results['claim_results'],
                'sources': results['sources']
            }
            
            return jsonify(response)
            
    except Exception as e:
        logger.error(f"Fehler beim Fact-Check: {e}")
        return jsonify({
            'error': f'Interner Serverfehler: {str(e)}',
            'success': False
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_database_stats():
    """API Endpoint für Datenbankstatistiken"""
    try:
        if factchecker is None:
            return jsonify({
                'error': 'Factchecker nicht verfügbar',
                'success': False
            }), 503
        
        with factchecker_lock:
            stats = factchecker.get_database_stats()
            return jsonify({
                'success': True,
                'stats': stats
            })
            
    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Stats: {e}")
        return jsonify({
            'error': f'Fehler beim Abrufen der Statistiken: {str(e)}',
            'success': False
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health Check Endpoint"""
    return jsonify({
        'status': 'healthy',
        'factchecker_available': factchecker is not None
    })

if __name__ == '__main__':

    init_thread = threading.Thread(target=initialize_factchecker)
    init_thread.daemon = True
    init_thread.start()
    

    time.sleep(2)
    
    # Start flask app
    app.run(debug=True, host='0.0.0.0', port=8080, threaded=True)