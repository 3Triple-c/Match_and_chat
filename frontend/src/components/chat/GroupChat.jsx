import { useEffect, useState } from "react";
import useGroupchat from "../../hooks/useGroupChat";
import api from "../../api/axios";
import MessageList from "../MessageList";
import { useAuthStore } from "../../stores/authStore";

export default function GroupChat({ groupId, session }) {
  const { messages, setMessages, sendMessage, connected } = useGroupchat(groupId);
  const user = useAuthStore(state => state.user);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const teacherId = session?.teacherUser?._id || session?.teacherUser;
  const userId = user?.id || user?._id;
  const phase = session?.currentPhase;
  const myParticipant = session?.participants?.find(
    participant => (participant.user?._id || participant.user)?.toString() === userId,
  );
  const chatLocked =
    session?.status === "active" &&
    (phase === "quiz" ||
      (phase === "teaching" &&
        teacherId?.toString() !== userId?.toString() &&
        !(myParticipant?.speakApproved && !myParticipant?.speakMuted)));

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    api
      .get(`/message/${groupId}/messages`)
      .then(res => {
        setMessages(res.data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [groupId, setMessages]);

  const submit = e => {
    e.preventDefault();
    if (!text.trim()) return;
    const sent = sendMessage(text.trim());
    if (sent) {
      setText("");
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {loading && <p className="muted">Loading messages...</p>}
        {!loading && <MessageList messages={messages} />}
      </div>
      {session?.status === "active" && (
        <p className="muted">
          {phase === "teaching" &&
            "Teaching mode is active. Only the current teacher or an approved unmuted speaker can post in chat."}
          {phase === "discussion" && "Discussion mode is active. Everyone can contribute."}
          {phase === "break" && "Break mode is active. Light conversation is open."}
          {phase === "quiz" && "Quiz mode is active. Chat is paused for focus."}
          {phase === "reveal" && "Reveal mode is active. Wrap up the session while the next teacher is announced."}
        </p>
      )}

      <form onSubmit={submit} className="chat-input">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message..."
          disabled={!connected || chatLocked}
        />
        <button
          className="btn btn-primary"
          disabled={!connected || chatLocked}
        >
          {connected ? "Send" : "Connecting..."}
        </button>
      </form>
    </div>
  );
}
