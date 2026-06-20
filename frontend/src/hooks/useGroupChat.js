import { useEffect, useState } from "react";
import { useSocketStore } from "../stores/socketStore";

export default function useGroupchat(groupId) {
  const { socket, connected } = useSocketStore();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket || !groupId) return;
    const handleNewMessage = message => {
      if (message.group === groupId) {
        setMessages(prev => [...prev, message]);
      }
    };

    socket.emit("joinGroup", { groupId });
    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, groupId]);

  const sendMessage = content => {
    if (!socket || !connected || !groupId || !content?.trim()) {
      return false;
    }

    socket.emit("sendMessage", { groupId, content });
    return true;
  };

  return {
    messages,
    setMessages,
    sendMessage,
    connected: connected && !!socket,
  };
}
