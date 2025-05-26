# Nod & Know

Nod & Know is an interactive security awareness demo. It uses your webcam to detect nodding for **yes** and shaking for **no** while you answer short security questions. Votes are stored in your browser and you can join an anonymous chat to discuss each question.

## Getting Started

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the development server:
   ```sh
   npm run dev
   ```
   The app runs on <http://localhost:8080> by default.
3. Build for production:
   ```sh
   npm run build
   ```
   The production files will be output to the `dist` directory.

## Code Overview

- **src/pages/Index.tsx** – main page that rotates through questions, collects votes and shows charts.
- **src/components/WebcamFeed.tsx** – handles MediaPipe face detection and interprets head gestures.
- **src/components/VoteChart.tsx** – displays the yes/no vote counts.
- **src/components/ChatInterface.tsx** – modal chat window driven by a mocked WebSocket service.
- **src/services/dataService.ts** – stores session data and lightweight analytics in `localStorage`.
- **src/services/websocketService.ts** – simulates a chat server for anonymous discussion.

Everything runs entirely in the browser, so no data is sent to a backend.

## Technologies

- React + TypeScript
- Vite
- Tailwind CSS and shadcn-ui components
- MediaPipe for facial gesture detection

## Deployment

After building the project, serve the contents of the `dist` folder with any static hosting provider.
