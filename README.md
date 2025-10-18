# iMessage Clone

This project delivers a web-based recreation of Apple's iMessage and FaceTime experiences with live messaging and peer-to-peer calling.

## Getting started

```bash
npm install
```

### Run the realtime server

```bash
npm run server
```

### Run the web client

```bash
npm run dev
```

### Run both together

```bash
npm run dev:full
```

### Build and launch the production bundle

```bash
npm run deploy
```

The deploy script builds the Vite client into `dist/` and then boots the Express server to serve the compiled assets alongside the realtime Socket.IO endpoints.

Open the Vite dev server URL (defaults to http://localhost:5173) in multiple browser windows to exercise realtime chat and FaceTime-style calling. The socket server listens on port 5174 by default; adjust the `VITE_REALTIME_URL` or `VITE_REALTIME_PORT` environment variables if you need to host it elsewhere.
