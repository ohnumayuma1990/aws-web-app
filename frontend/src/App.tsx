import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const App: React.FC = () => {
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const [users, setUsers] = useState<string[]>([]);

  const ws = useRef<WebSocket | null>(null);

  // You will replace this with your actual CDK output endpoint
  const WSS_URL = process.env.REACT_APP_WSS_URL || 'wss://your-api-gateway-url.execute-api.region.amazonaws.com/prod';

  useEffect(() => {
    ws.current = new WebSocket(WSS_URL);

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Message received:", data);

      if (data.action === "roomCreated" || data.action === "roomJoined") {
        setRoomId(data.roomId);
        if (data.users) setUsers(data.users);
      } else if (data.action === "userJoined") {
        setUsers(prev => [...prev, data.connectionId]);
        setMessages(prev => [...prev, `User joined: ${data.connectionId}`]);
      } else if (data.action === "userLeft") {
        setUsers(prev => prev.filter(u => u !== data.connectionId));
        setMessages(prev => [...prev, `User left: ${data.connectionId}`]);
      } else if (data.action === "messageReceived") {
        setMessages(prev => [...prev, `${data.from}: ${data.message}`]);
      }
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    };

    return () => {
      ws.current?.close();
    };
  }, [WSS_URL]);

  const createRoom = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "createRoom" }));
    }
  };

  const joinRoom = () => {
    if (ws.current?.readyState === WebSocket.OPEN && inputRoomId) {
      ws.current.send(JSON.stringify({ action: "joinRoom", roomId: inputRoomId }));
    }
  };

  const sendMessage = () => {
    if (ws.current?.readyState === WebSocket.OPEN && inputMessage && roomId) {
      ws.current.send(JSON.stringify({ action: "sendMessage", roomId, message: inputMessage }));
      setMessages(prev => [...prev, `Me: ${inputMessage}`]);
      setInputMessage('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Serverless Game</h1>
        <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>

        {!roomId ? (
          <div>
            <button onClick={createRoom}>Create Room</button>
            <div style={{ marginTop: '20px' }}>
              <input
                type="text"
                placeholder="Room ID"
                value={inputRoomId}
                onChange={e => setInputRoomId(e.target.value)}
              />
              <button onClick={joinRoom}>Join Room</button>
            </div>
          </div>
        ) : (
          <div>
            <h3>Room: {roomId}</h3>
            <div>
              <h4>Users in room:</h4>
              <ul>
                {users.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
            <div style={{ border: '1px solid white', padding: '10px', height: '200px', overflowY: 'scroll', marginBottom: '10px', width: '300px', textAlign: 'left' }}>
              {messages.map((m, i) => <div key={i}>{m}</div>)}
            </div>
            <div>
              <input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
