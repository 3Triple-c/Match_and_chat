import { useEffect, useState } from "react";
import { useSocketStore } from "../stores/socketStore";

export default function useGroupchat(groupId) {
  const { socket } = useSocketStore();
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket || !groupId) return;
    socket.emit("joinGroup", { groupId });

    socket.on("newMessage", message => {
      if (message.group === groupId) {
        setMessages(prev => [...prev, message]);
      }
    });
    return () => {
      socket.off("newMessage");
    };
  }, [socket, groupId]);
  const sendMessage = content => {
    socket.emit("sendMessage", { groupId, content });
  };
  return { messages, sendMessage };
}
