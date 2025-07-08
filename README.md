# Nod & Know

Nod & Know is an interactive security awareness demo. It uses your webcam to detect nodding for **yes** and shaking for **no** while you answer short security questions. Votes are stored in your browser and you can join an anonymous chat to discuss each question.
Messages that begin with `@ai` will summon an automated assistant powered by DeepSeek to provide more information about the current topic. Answers include a couple of suggested follow-up questions to keep the discussion going.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the WebSocket server:
   ```sh
   # DEEPSEEK_API_KEY is optional but required for the @ai assistant
   DEEPSEEK_API_KEY=your_key npm run server
   ```
   This starts a Socket.IO server on <http://localhost:3001>.

3. Start the development server:
   ```sh
   npm run dev
   ```
   The app runs on <http://localhost:8080> by default.
   You can view aggregated session statistics at <http://localhost:8080/stats> while the server is running.
4. Build for production:
   ```sh
   npm run build
   ```
   The production files will be output to the `dist` directory.

## Code Overview

- **src/pages/Index.tsx** – main page that rotates through questions, collects votes and shows charts.
- **src/components/WebcamFeed.tsx** – handles MediaPipe face detection and interprets head gestures.
- **src/components/VoteChart.tsx** – displays the yes/no vote counts.
- **src/components/ChatInterface.tsx** – modal chat window that connects to a Socket.IO chat server and can generate a QR code for joining from another device.
- **src/services/dataService.ts** – stores session data and lightweight analytics in `localStorage`.
- **src/services/websocketService.ts** – WebSocket client wrapper used by the chat interface.
- **src/pages/Stats.tsx** – visualizes anonymous event logs and vote data.

Voting runs entirely in the browser. A small Node.js server handles real-time chat messages.

## Technologies

- React + TypeScript
- Vite
- Tailwind CSS and shadcn-ui components
- MediaPipe for facial gesture detection

## Deployment

After building the project, serve the contents of the `dist` folder with any static hosting provider.
