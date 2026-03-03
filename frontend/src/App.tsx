import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Card {
  suit: string;
  value: string;
}

interface GameState {
  field: Card[];
  deckCount: number;
  currentTurnIndex: number;
  turnStartTime: number;
  status: 'waiting' | 'playing' | 'ended';
  winnerId?: string;
}

const App: React.FC = () => {
  const [roomId, setRoomId] = useState<string>('');
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const [users, setUsers] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [roomsList, setRoomsList] = useState<{ roomId: string; createdAt: number }[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [scores, setScores] = useState<{ [cid: string]: number }>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const ws = useRef<WebSocket | null>(null);
  const myConnectionId = useRef<string>('');

  // You will replace this with your actual CDK output endpoint
  const WSS_URL = process.env.REACT_APP_WSS_URL || 'wss://your-api-gateway-url.execute-api.region.amazonaws.com/prod';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState && gameState.status === 'playing') {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameState.turnStartTime) / 1000);
        setTimeLeft(Math.max(0, 30 - elapsed));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    ws.current = new WebSocket(WSS_URL);

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Message received:", data);

      switch (data.action) {
        case "roomCreated":
        case "roomJoined":
          setRoomId(data.roomId);
          if (data.users) {
            setUsers(data.users);
            const initialScores: { [cid: string]: number } = {};
            data.users.forEach((u: string) => initialScores[u] = 0);
            setScores(initialScores);
          }
          if (data.action === "roomCreated") {
             myConnectionId.current = data.users[0];
          } else if (data.action === "roomJoined") {
             myConnectionId.current = data.users[data.users.length - 1];
          }
          break;
        case "userJoined":
          setUsers(prev => [...prev, data.connectionId]);
          setScores(prev => ({ ...prev, [data.connectionId]: 0 }));
          setMessages(prev => [...prev, `${data.connectionId} が入室しました`]);
          break;
        case "userLeft":
          setUsers(prev => prev.filter(u => u !== data.connectionId));
          setMessages(prev => [...prev, `${data.connectionId} が退室しました`]);
          break;
        case "roomsList":
          setRoomsList(data.rooms);
          break;
        case "leftRoom":
          setRoomId('');
          setGameState(null);
          setHand([]);
          break;
        case "gameStarted":
          setGameState(data.gameState);
          setUsers(data.players);
          setHand([]);
          const startScores: { [cid: string]: number } = {};
          data.players.forEach((u: string) => startScores[u] = 0);
          setScores(startScores);
          break;
        case "cardDrawn":
          setGameState(prev => prev ? { ...prev, deckCount: data.deckCount } : null);
          if (data.card) setHand(prev => [...prev, data.card]);
          break;
        case "cardPlayed":
          setGameState(prev => prev ? {
            ...prev,
            field: [...prev.field, data.card],
            currentTurnIndex: data.nextTurnIndex,
            turnStartTime: data.turnStartTime
          } : null);
          break;
        case "scoreUpdated":
          setScores(prev => ({ ...prev, [data.connectionId]: data.score }));
          if (data.winnerId) {
            setGameState(prev => prev ? { ...prev, status: 'ended', winnerId: data.winnerId } : null);
          }
          break;
        case "gameReset":
          setGameState(null);
          setHand([]);
          const resetScores: { [cid: string]: number } = {};
          users.forEach(u => resetScores[u] = 0);
          setScores(resetScores);
          break;
        case "messageReceived":
          setMessages(prev => [...prev, `${data.from}: ${data.message}`]);
          break;
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
      ws.current.send(JSON.stringify({ action: "createRoom", isPrivate }));
    }
  };

  const searchRooms = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "searchRooms" }));
    }
  };

  const leaveRoom = () => {
    if (ws.current?.readyState === WebSocket.OPEN && roomId) {
      ws.current.send(JSON.stringify({ action: "leaveRoom", roomId }));
    }
  };

  const startGame = () => {
    if (ws.current?.readyState === WebSocket.OPEN && roomId) {
      ws.current.send(JSON.stringify({ action: "startGame", roomId }));
    }
  };

  const drawCard = () => {
    if (ws.current?.readyState === WebSocket.OPEN && roomId) {
      ws.current.send(JSON.stringify({ action: "drawCard", roomId }));
    }
  };

  const playCard = (index: number) => {
    if (ws.current?.readyState === WebSocket.OPEN && roomId) {
      ws.current.send(JSON.stringify({ action: "playCard", roomId, cardIndex: index }));
      setHand(prev => prev.filter((_, i) => i !== index));
    }
  };

  const actOnCard = (index: number) => {
    if (ws.current?.readyState === WebSocket.OPEN && roomId) {
      ws.current.send(JSON.stringify({ action: "actOnCard", roomId, cardIndex: index }));
    }
  };

  const resetGame = () => {
    if (ws.current?.readyState === WebSocket.OPEN && roomId) {
      ws.current.send(JSON.stringify({ action: "resetGame", roomId }));
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
      setMessages(prev => [...prev, `自分: ${inputMessage}`]);
      setInputMessage('');
    }
  };

  const isMyTurn = gameState && users[gameState.currentTurnIndex] === myConnectionId.current;

  return (
    <div className="App">
      <header className="App-header">
        <h1>サーバーレス対戦ゲーム</h1>
        <p>ステータス: {connected ? '接続済み' : '切断'}</p>

        {!roomId ? (
          <div className="lobby">
            <div className="room-creation">
              <label>
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                プライベートルーム
              </label>
              <button onClick={createRoom}>ルームを作成</button>
            </div>

            <div style={{ marginTop: '20px' }}>
              <input
                type="text"
                placeholder="ルームIDを入力"
                value={inputRoomId}
                onChange={e => setInputRoomId(e.target.value)}
              />
              <button onClick={joinRoom}>ルームに参加</button>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button onClick={searchRooms}>公開ルームを検索</button>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {roomsList.map(r => (
                  <li key={r.roomId} style={{ margin: '5px 0' }}>
                    {r.roomId} (作成: {new Date(r.createdAt).toLocaleTimeString()})
                    <button onClick={() => setInputRoomId(r.roomId)} style={{ marginLeft: '10px' }}>選択</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="game-container">
            <div style={{ position: 'absolute', top: 10, right: 10 }}>
               <button onClick={leaveRoom}>退出</button>
            </div>
            <h3>ルームID: {roomId} <button onClick={() => navigator.clipboard.writeText(roomId)} style={{fontSize: '12px'}}>IDをコピー</button></h3>

            <div className="game-layout" style={{ display: 'flex', gap: '20px' }}>
              <div className="sidebar" style={{ width: '200px', textAlign: 'left' }}>
                <h4>プレイヤー:</h4>
                <ul>
                  {users.map((u, i) => (
                    <li key={i} style={{ color: gameState?.currentTurnIndex === i ? 'yellow' : 'white' }}>
                      {u}: {scores[u] || 0} pts {gameState?.currentTurnIndex === i && '◀'}
                    </li>
                  ))}
                </ul>
                <div style={{ border: '1px solid white', padding: '10px', height: '150px', overflowY: 'scroll', marginBottom: '10px', fontSize: '12px' }}>
                  {messages.map((m, i) => <div key={i}>{m}</div>)}
                </div>
                <input
                  type="text"
                  placeholder="チャット..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="main-board" style={{ flex: 1, border: '2px solid gray', padding: '20px', borderRadius: '10px' }}>
                {gameState?.status === 'playing' ? (
                  <div>
                    <div className="status-bar">
                      <p>残り時間: {timeLeft}s | 山札: {gameState.deckCount}枚</p>
                    </div>
                    <div className="field" style={{ minHeight: '100px', background: '#333', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px' }}>
                      {gameState.field.map((c, i) => (
                        <div key={i} className="card" onClick={() => actOnCard(i)} style={{ border: '1px solid white', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>
                          {c.suit}{c.value}
                        </div>
                      ))}
                    </div>
                    <div className="controls">
                       <button onClick={drawCard}>カードを引く</button>
                    </div>
                    <div className="hand" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      {hand.map((c, i) => (
                        <div key={i} className="card" onClick={() => playCard(i)} style={{ border: '1px solid white', padding: '10px', borderRadius: '5px', cursor: 'pointer', background: 'white', color: 'black' }}>
                          {c.suit}{c.value}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : gameState?.status === 'ended' ? (
                  <div className="victory-screen">
                    <h2>勝利: {gameState.winnerId}</h2>
                    <button onClick={resetGame}>再戦</button>
                  </div>
                ) : (
                  <div>
                    <p>他のプレイヤーを待っています...</p>
                    {users.length >= 1 && <button onClick={startGame}>ゲーム開始</button>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
