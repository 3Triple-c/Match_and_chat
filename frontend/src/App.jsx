import AppRoutes from "./routes/AppRoutes";
import { useAuthStore } from "./stores/authStore";
import { useEffect } from "react";
import { useSocketStore } from "./stores/socketStore";
import AppErrorBoundary from "./components/AppErrorBoundary";

function App() {
  const token = useAuthStore(state => state.token);
  const socket = useSocketStore(state => state.socket);
  const connect = useSocketStore(state => state.connect);

  useEffect(() => {
    if (token && !socket) {
      connect(token);
    }
  }, [token, socket, connect]);

  return (
    <AppErrorBoundary>
      <AppRoutes />
    </AppErrorBoundary>
  );
}

export default App;
//
// #EBEBEB
// #575757
// #9CDAC9
// #99978B
// #45BA9A
//
