# SecureMatch 🔐

A modern, interactive cybersecurity awareness platform that combines gesture-based voting with real-time discussions. Users answer security questions through facial gestures (nod/shake) and engage in anonymous discussions with others who have different viewpoints.

## ✨ Features

### 🎯 Core Functionality
- **Gesture-Based Voting**: Use webcam to detect head nods (yes) and shakes (no)
- **Real-Time Discussions**: Anonymous chat with users who have opposing viewpoints
- **Mobile Integration**: QR code generation for seamless mobile participation
- **Privacy-First**: No personal data collection, completely anonymous
- **Interactive Learning**: Cybersecurity questions with AI-powered explanations

### 🔧 Technical Features
- **Face Detection**: MediaPipe-powered facial landmark detection
- **WebSocket Communication**: Real-time chat and voting updates
- **Local Network Support**: Automatic IP detection with manual fallback
- **Responsive Design**: Works on desktop and mobile devices
- **Analytics Dashboard**: Session statistics and voting trends
- **Persistent Sessions**: Local storage for vote tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Modern web browser with webcam access
- Local network access for multi-device functionality

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd securematch
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the development servers**

Frontend (Port 8080):
```bash
npm run dev
```

Backend WebSocket server (Port 3001):
```bash
# In a separate terminal
npm run server
```

4. **Access the application**
- Open http://localhost:8080 in your browser
- Allow webcam permissions when prompted
- The app will auto-detect your local IP for QR code generation

## 🎮 How to Use

### For Presenters/Hosts

1. **Start a Session**
   - Launch the application on your main screen
   - Allow webcam access for gesture detection
   - The system will display security questions in phases:
     - **Info Phase**: Shows security statistics (10s)
     - **Question Phase**: Participants vote via gestures (45s)
     - **Results Phase**: Shows voting results and discussion prompts (90s)

2. **Enable Mobile Participation**
   - QR codes are automatically generated during the Results phase
   - Participants can scan to join anonymous discussions
   - Manual IP entry available if auto-detection fails

3. **Monitor Engagement**
   - Real-time face detection and vote counting
   - Debug mode available for technical monitoring
   - Analytics tracking for session insights

### For Participants

1. **Desktop Participation**
   - Face the camera and make clear head gestures
   - **Nod** for YES answers
   - **Shake** for NO answers
   - Each face can vote once per question

2. **Mobile Participation**
   - Scan QR code during Results phase
   - Join anonymous chat discussions
   - Ask follow-up questions provided by the system

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for responsive styling
- **Radix UI** for accessible components
- **MediaPipe** for face detection
- **Socket.io Client** for real-time communication

### Backend Services
- **WebSocket Server** (Node.js/Socket.io)
- **Local IP Detection Service**
- **AI Answer Generation** (integrated endpoint)

### Key Components

```
src/
├── components/
│   ├── WebcamFeed.tsx          # Face detection & gesture recognition
│   ├── ChatInterface.tsx       # Real-time chat system
│   ├── QuestionDisplay.tsx     # Security question presentation
│   ├── VoteChart.tsx          # Real-time voting results
│   └── ui/                    # Reusable UI components
├── hooks/
│   └── useMediaPipeFaceDetection.ts  # Face detection logic
├── services/
│   ├── dataService.ts         # Local storage & analytics
│   └── websocketService.ts    # WebSocket communication
└── pages/
    ├── Index.tsx              # Main application
    └── Stats.tsx              # Analytics dashboard
```

## 🎨 Customization

### Security Questions
Modify questions in `src/pages/Index.tsx`:

```typescript
const SECURITY_QUESTIONS: SecurityQuestionSet[] = [
  {
    recommended: 'no',
    question: "Do you reuse the same password across multiple accounts?",
    followUps: [
      "What are your strategies for managing multiple passwords?",
      // Add more follow-up questions...
    ]
  },
  // Add more questions...
];
```

### Timing Configuration
Adjust phase durations in `src/pages/Index.tsx`:

```typescript
const Info_DURATION_MS = 10000;      // Info display time
const QUESTION_DURATION_MS = 45000;   // Voting time
const RESULTS_DURATION_MS = 90000;    // Discussion time
const FOLLOW_UP_INTERVAL_MS = 15000;  // Follow-up rotation
```

### Gesture Sensitivity
Fine-tune detection thresholds:

```typescript
const [nodThreshold, setNodThreshold] = useState(0.01);    // Nod sensitivity
const [shakeThreshold, setShakeThreshold] = useState(0.01); // Shake sensitivity
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file for custom configuration:

```env
VITE_WS_URL=ws://localhost:3001  # WebSocket server URL
VITE_DEBUG_MODE=false            # Enable debug features
```

### Network Setup
- The app auto-detects local IP addresses for QR code generation
- Supports private network ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Manual IP input available as fallback
- Requires participants to be on the same network

## 📊 Analytics & Privacy

### Data Collection
- **Anonymous only**: No personal identifiable information
- **Local storage**: All data stays on the device
- **Session-based**: Data cleared between sessions
- **Gesture events**: Vote counts and timing only
- **Network**: No external data transmission (except QR generation)

### Exported Data Format
```json
{
  "votes": { "questionId": { "yes": 5, "no": 3 } },
  "events": [{ "type": "vote", "timestamp": 1234567890 }],
  "sessionStats": { "duration": 1800000, "totalVotes": 8 }
}
```

## 🛠️ Development

### Debug Mode
Enable debug features by adding `?debug=true` to the URL:
- Real-time face detection visualization
- Gesture sensitivity sliders
- Network configuration tools
- Vote testing buttons
- Technical monitoring panels

### Build for Production
```bash
npm run build
npm run preview  # Test production build
```

### WebSocket Server
The backend server handles real-time communication:
```javascript
// Basic server structure
const io = require('socket.io')(3001, {
  cors: { origin: "http://localhost:8080" }
});

io.on('connection', (socket) => {
  // Handle room joining, messaging, etc.
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow the existing component structure
- Add proper error handling for MediaPipe operations
- Test gesture detection across different lighting conditions
- Ensure mobile responsiveness

## 📋 Requirements

### Browser Support
- Chrome 88+ (recommended for MediaPipe)
- Firefox 85+
- Safari 14+ (limited MediaPipe support)
- Edge 88+

### Hardware Requirements
- Webcam access required for gesture detection
- Minimum 2GB RAM for smooth MediaPipe operation
- Local network connectivity for multi-device features

### Permissions
- Camera access for face detection
- Local network access for QR code functionality

## 🐛 Troubleshooting

### Common Issues

**Camera not detected:**
- Check browser permissions
- Ensure no other apps are using the camera
- Try refreshing the page

**QR code generation fails:**
- Check network connectivity
- Try manual IP input option
- Verify firewall settings for port 3001

**Gesture detection not working:**
- Ensure good lighting conditions
- Position face clearly in camera view
- Adjust sensitivity sliders in debug mode
- Check browser MediaPipe support

**Chat not connecting:**
- Verify WebSocket server is running
- Check if port 3001 is accessible
- Ensure devices are on the same network

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **MediaPipe** by Google for face detection capabilities
- **Socket.io** for real-time communication
- **Tailwind CSS** for responsive design system
- **Radix UI** for accessible component primitives
- **React** ecosystem for the development framework

---

**SecureMatch** - Making cybersecurity education interactive, engaging, and accessible for everyone! 🔐✨