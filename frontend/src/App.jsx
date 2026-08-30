import { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import CoinSelector from './components/CoinSelector';
import PriceDisplay from './components/PriceDisplay';
import Timer from './components/Timer';
import BetSection from './components/BetSection';
import ActiveBets from './components/ActiveBets';
import HistoryList from './components/HistoryList';
import PriceChart from './components/PriceChart';
import Toast from './components/Toast';
import RegisterModal from './components/RegisterModal';
import LoginModal from './components/LoginModal';
import { fakePrices, PAYOUT, MINUTE, WINDOW } from './data/constants';
import { socket } from './api/socket';

const HISTORY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export default function App() {
  // ── State (this replaces every loose "let" at the top of script.js) ──
  const [balance, setBalance] = useState(1000);
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [currentPrices, setCurrentPrices] = useState(() => {
    const obj = {};
    for (const coin in fakePrices) obj[coin] = fakePrices[coin].price;
    return obj;
  });
  // Snapshot of each coin's price at the start of the current round —
  // used as the reference point for the % change shown in PriceDisplay.
  const [roundStartPrices, setRoundStartPrices] = useState(() => {
    const obj = {};
    for (const coin in fakePrices) obj[coin] = fakePrices[coin].price;
    return obj;
  });
  // Rolling price history per coin, used by the chart (last 10 minutes).
  const [priceHistory, setPriceHistory] = useState(() => {
    const obj = {};
    for (const coin in fakePrices) obj[coin] = [];
    return obj;
  });
  const [sidePanelView, setSidePanelView] = useState('chart'); // 'chart' | 'activity'
  const [cycleSecond, setCycleSecond] = useState(0);
  const [bets, setBets] = useState([]);
  const [history, setHistory] = useState([]);
  const [betAmount, setBetAmount] = useState(100);
  const [betStatus, setBetStatus] = useState({ text: '', type: '' });
  const [toast, setToast] = useState({ msg: '', type: '', show: false });
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  // The game loop runs on a 1s interval that's only created once (empty deps
  // below). To read the LATEST bets/prices/coin from inside it without
  // stale closures, we mirror them into refs every render.
  const betsRef = useRef(bets);
  betsRef.current = bets;
  const pricesRef = useRef(currentPrices);
  pricesRef.current = currentPrices;

  // ── Persist auth state to localStorage so a page refresh doesn't log out ──
  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
    else localStorage.removeItem('currentUser');
  }, [currentUser]);

  // ── Listen for real-time crypto prices from the backend's Socket.io gateway ──
  useEffect(() => {
    function handleTicker(ticker) {
      const coin = ticker.symbol.split('/')[0]; // "BTC/EUR" -> "BTC"
      const now = Date.now();

      setCurrentPrices((prev) => ({ ...prev, [coin]: ticker.last }));

      setPriceHistory((prev) => {
        const points = [...(prev[coin] || []), { time: now, price: ticker.last }];
        const cutoff = now - HISTORY_WINDOW_MS;
        return { ...prev, [coin]: points.filter((p) => p.time >= cutoff) };
      });
    }

    socket.on('crypto:ticker', handleTicker);
    return () => socket.off('crypto:ticker', handleTicker);
  }, []);

  // ── "Methods" (same responsibilities as the functions in script.js) ──

  function showToast(msg, type) {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  }

  function updateBalance(amount) {
    setBalance((b) => Math.max(0, b + amount));
  }

  function resolveBet(bet, exitPrice) {
    const wentUp = exitPrice > bet.entry;
    const won = (bet.direction === 'up' && wentUp) || (bet.direction === 'down' && !wentUp);
    const diff = ((exitPrice - bet.entry) / bet.entry) * 100;

    if (won) {
      const payout = Math.floor(bet.amount * PAYOUT);
      updateBalance(payout);
      showToast(`✓ WIN ${bet.coin} +T$ ${payout}`, 'win');
    } else {
      showToast(`✗ LOSS ${bet.coin} -T$ ${bet.amount}`, 'loss');
    }

    setHistory((h) =>
      [{ id: Date.now() + Math.random(), coin: bet.coin, direction: bet.direction, amount: bet.amount, won, diff }, ...h].slice(0, 8)
    );

    setBetStatus({
      text: `${bet.coin} ${won ? 'WIN' : 'LOSS'} (${wentUp ? '+' : ''}${diff.toFixed(3)}%)`,
      type: won ? 'up' : 'down',
    });
  }

  function placeBet(direction) {
    const amount = parseInt(betAmount, 10) || 100;

    if (amount > balance) {
      setBetStatus({ text: 'Insufficient balance', type: 'down' });
      return;
    }

    updateBalance(-amount);
    const isQueued = cycleSecond >= WINDOW;
    const bet = {
      id: Date.now() + Math.random(),
      coin: selectedCoin,
      direction,
      amount,
      entry: isQueued ? null : currentPrices[selectedCoin],
      status: isQueued ? 'queued' : 'active',
    };
    setBets((prev) => [...prev, bet]);
    setBetStatus({
      text: isQueued
        ? `Queued: ${direction.toUpperCase()} on ${selectedCoin} (next round)`
        : `Active: ${direction.toUpperCase()} on ${selectedCoin}`,
      type: '',
    });
  }

  async function handleLoginSuccess(accessToken) {
    setToken(accessToken);
    // decode just enough to greet them — or fetch /users with the token later
    showToast('Logged in!', 'win');
    setCurrentUser({ username: 'placeholder' }); // see note below
  }

  // ── Round timer: advances the clock and resolves bets every minute ──
  useEffect(() => {
    const interval = setInterval(() => {
      setCycleSecond((prevSecond) => {
        const next = (prevSecond + 1) % MINUTE;

        if (next === 0) {
          const latestPrices = pricesRef.current;
          const currentBets = betsRef.current;

          currentBets.forEach((bet) => {
            if (bet.status === 'active' && bet.entry !== null) {
              resolveBet(bet, latestPrices[bet.coin]);
            }
          });

          setBets((prev) =>
            prev
              .filter((b) => !(b.status === 'active' && b.entry !== null)) // drop resolved
              .map((b) => (b.status === 'queued' ? { ...b, status: 'active', entry: latestPrices[b.coin] } : b))
          );
          setBetStatus({ text: '', type: '' });

          // New round starting — snapshot current prices as the new reference point
          setRoundStartPrices({ ...latestPrices });
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps: set up once, reads latest state via refs

  const hasQueuedBet = bets.some((b) => b.status === 'queued');

  return (
    <>
      <Navbar
        balance={balance}
        onRegisterClick={() => setShowRegister(true)}
        onLoginClick={() => setShowLogin(true)}
        currentUser={currentUser}
        onLogout={() => { setCurrentUser(null); setToken(null); }}
      />

      <main className="page-content">
        <div className="trading-layout">
          <div className="trading-panel">
            <CoinSelector selectedCoin={selectedCoin} onSelect={setSelectedCoin} />
            <PriceDisplay
              coin={selectedCoin}
              price={currentPrices[selectedCoin]}
              basePrice={roundStartPrices[selectedCoin]}
              stats={fakePrices[selectedCoin]}
            />
            <Timer cycleSecond={cycleSecond} hasQueuedBet={hasQueuedBet} />
            <BetSection
              betAmount={betAmount}
              onAmountChange={setBetAmount}
              balance={balance}
              onBet={placeBet}
              betStatus={betStatus}
            />
          </div>

          <div className="side-panel">
            <div className="side-panel-tabs">
              <button
                className={`side-tab-btn ${sidePanelView === 'chart' ? 'active' : ''}`}
                onClick={() => setSidePanelView('chart')}
              >
                Chart
              </button>
              <button
                className={`side-tab-btn ${sidePanelView === 'activity' ? 'active' : ''}`}
                onClick={() => setSidePanelView('activity')}
              >
                Activity
              </button>
            </div>

            {sidePanelView === 'chart' ? (
              <PriceChart coin={selectedCoin} data={priceHistory[selectedCoin] || []} />
            ) : (
              <>
                <ActiveBets bets={bets} />
                <HistoryList history={history} />
              </>
            )}
          </div>
        </div>
      </main>

      <Toast {...toast} />

      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSuccess={(user) => {
            setCurrentUser(user);
            showToast(`Welcome, ${user.username}!`, 'win');
          }}
        />
      )}

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </>
  );
}